"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  lerColunasOcultas,
  limparColunasOcultas,
  salvarColunasOcultas,
} from "./preferencias-tabela";

interface EstadoColunas {
  tabela: string | undefined;
  ocultas: Set<string>;
}

/** Arrays de chaves viajam como string estável: a identidade muda a cada render. */
function comoChaves(estavel: string): string[] {
  return estavel === "" ? [] : estavel.split("\u0000");
}

function mesmoConjunto(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const chave of a) {
    if (!b.has(chave)) return false;
  }
  return true;
}

/**
 * Remove do conjunto oculto as colunas fixas — elas nunca podem ser escondidas.
 * Devolve o próprio conjunto quando não havia nenhuma fixa escondida.
 */
function semFixas(ocultas: Set<string>, fixas: Set<string>): Set<string> {
  let mudou = false;
  const proximo = new Set(ocultas);
  for (const chave of fixas) {
    if (proximo.delete(chave)) mudou = true;
  }
  return mudou ? proximo : ocultas;
}

/**
 * Garante que pelo menos uma coluna fique visível: se o conjunto salvo esconde
 * todas, a primeira coluna volta a aparecer.
 */
function manterUmaVisivel(
  ocultas: Set<string>,
  chaves: string[],
): Set<string> {
  if (chaves.length === 0) return ocultas;
  if (chaves.some((chave) => !ocultas.has(chave))) return ocultas;

  const proximo = new Set(ocultas);
  for (const chave of chaves) {
    // `delete` devolve `true` na chave que realmente existia no conjunto.
    if (proximo.delete(chave)) break;
  }
  return proximo;
}

/**
 * Colunas visíveis de uma tabela, com a preferência persistida no IndexedDB.
 *
 * O conjunto guardado é o das colunas **ocultas**. O padrão (`ocultasPadrao`,
 * vindo de `Column.defaultHidden`) vale quando não há preferência salva; numa
 * preferência existente ele só se aplica às colunas **novas**, isto é, fora de
 * `conhecidas` — assim uma coluna opcional criada numa versão futura nasce
 * oculta sem sobrescrever as escolhas do usuário. Sem `tabela`, o padrão é
 * aplicado apenas em memória (nada é lido nem persistido).
 *
 * `carregado` começa `false` para a tabela renderizar completa no SSR (já com o
 * padrão) e só aplicar a preferência no cliente.
 *
 * Colunas **fixas** (`chavesFixas`) nunca entram no conjunto oculto: uma
 * preferência antiga que escondia o código, por exemplo, é normalizada e
 * persistida sem ela.
 */
export function useColunasVisiveis(
  tabela: string | undefined,
  chaves: string[],
  ocultasPadrao: string[] = [],
  chavesFixas: string[] = [],
) {
  const chaveEstavel = chaves.join("\u0000");
  const padraoEstavel = ocultasPadrao.join("\u0000");
  const fixasEstavel = chavesFixas.join("\u0000");

  /** Só valem padrões/fixas de colunas que existem nesta tabela. */
  const padrao = useMemo(() => {
    const existentes = new Set(comoChaves(chaveEstavel));
    const fixas = new Set(comoChaves(fixasEstavel));
    return new Set(
      comoChaves(padraoEstavel).filter(
        (chave) => existentes.has(chave) && !fixas.has(chave),
      ),
    );
  }, [chaveEstavel, padraoEstavel, fixasEstavel]);

  const [estado, setEstado] = useState<EstadoColunas>(() => ({
    tabela,
    // O SSR já nasce com o padrão aplicado — e com a regra de pelo menos uma
    // coluna visível, mesmo que um padrão mal configurado esconda todas.
    ocultas: manterUmaVisivel(new Set(padrao), comoChaves(chaveEstavel)),
  }));
  const [tabelaCarregada, setTabelaCarregada] = useState<string | undefined>(
    undefined,
  );

  /** Set atual — evita fechar sobre o estado velho nos handlers. */
  const ocultasRef = useRef<Set<string>>(
    manterUmaVisivel(new Set(padrao), comoChaves(chaveEstavel)),
  );
  const tabelaCarregadaRef = useRef<string | undefined>(undefined);
  /** Chaves de colunas que a preferência carregada/salva conhece. */
  const conhecidasRef = useRef<Set<string> | null>(null);

  const ocultas = estado.tabela === tabela ? estado.ocultas : padrao;
  const carregado = tabela === undefined || tabelaCarregada === tabela;

  const aplicar = useCallback(
    (proximo: Set<string>) => {
      ocultasRef.current = proximo;
      setEstado({ tabela, ocultas: proximo });
    },
    [tabela],
  );

  useEffect(() => {
    if (!tabela) return;

    const lista = comoChaves(chaveEstavel);
    const existentes = new Set(lista);
    const fixasAtuais = new Set(
      comoChaves(fixasEstavel).filter((chave) => existentes.has(chave)),
    );
    const padraoAtual = new Set(
      comoChaves(padraoEstavel).filter(
        (chave) => existentes.has(chave) && !fixasAtuais.has(chave),
      ),
    );

    // A lista de colunas mudou para a mesma tabela (ex.: coluna condicional):
    // descarta as preferências de colunas que não existem mais e aplica o
    // padrão às que apareceram agora, sem reler o IndexedDB.
    if (tabelaCarregadaRef.current === tabela) {
      const atuais = ocultasRef.current;
      const conhecidas = conhecidasRef.current ?? existentes;

      const proximo = new Set(
        [...semFixas(atuais, fixasAtuais)].filter((chave) =>
          existentes.has(chave),
        ),
      );
      for (const chave of lista) {
        if (conhecidas.has(chave)) continue;
        if (padraoAtual.has(chave)) proximo.add(chave);
        else proximo.delete(chave);
      }

      const normalizadas = manterUmaVisivel(proximo, lista);
      conhecidasRef.current = new Set(lista);

      if (!mesmoConjunto(normalizadas, atuais)) aplicar(normalizadas);
      return;
    }

    let cancelado = false;

    void (async () => {
      const preferencia = await lerColunasOcultas(tabela);
      if (cancelado) return;

      let normalizadas: Set<string>;
      let precisaSalvar = false;

      if (preferencia === null) {
        // Nunca salvou: o padrão vale por inteiro, inclusive as colunas
        // opcionais ocultas por `defaultHidden`.
        normalizadas = manterUmaVisivel(new Set(padraoAtual), lista);
      } else {
        // Registro antigo (sem `conhecidas`): as colunas que já têm padrão
        // oculto são tratadas como novas para recebê-lo; as demais são
        // consideradas conhecidas, preservando o conjunto oculto salvo.
        const conhecidas = preferencia.conhecidas
          ? new Set(preferencia.conhecidas)
          : new Set(lista.filter((chave) => !padraoAtual.has(chave)));
        const filtradas = new Set(
          preferencia.ocultas.filter((chave) => existentes.has(chave)),
        );
        // Preferência antiga pode ter escondido uma coluna que virou fixa:
        // ela volta a aparecer e a normalização é persistida abaixo.
        const mescladas = semFixas(filtradas, fixasAtuais);

        // Coluna nova (fora de `conhecidas`) nasce com o próprio padrão: oculta
        // quando tem `defaultHidden`, visível quando não tem.
        for (const chave of lista) {
          if (conhecidas.has(chave)) continue;
          if (padraoAtual.has(chave)) mescladas.add(chave);
          else mescladas.delete(chave);
        }

        normalizadas = manterUmaVisivel(mescladas, lista);

        precisaSalvar =
          preferencia.ocultas.length !== filtradas.size ||
          !mesmoConjunto(normalizadas, filtradas) ||
          !mesmoConjunto(conhecidas, existentes);
      }

      tabelaCarregadaRef.current = tabela;
      conhecidasRef.current = new Set(lista);
      aplicar(normalizadas);
      setTabelaCarregada(tabela);

      // Só persiste quando a leitura precisou ser normalizada. Sem preferência
      // salva, o padrão fica só em memória para "Restaurar padrão" continuar
      // significando "apagar a preferência".
      if (precisaSalvar) {
        void salvarColunasOcultas(tabela, [...normalizadas], lista);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [tabela, chaveEstavel, padraoEstavel, fixasEstavel, aplicar]);

  /** Mostra/esconde uma coluna. Coluna fixa e a última visível não são escondidas. */
  const alternar = useCallback(
    (chave: string) => {
      const lista = comoChaves(chaveEstavel);
      if (!lista.includes(chave)) return;
      if (comoChaves(fixasEstavel).includes(chave)) return;

      const atuais = ocultasRef.current;
      const proximo = new Set(atuais);

      if (proximo.has(chave)) {
        proximo.delete(chave);
      } else {
        const visiveis = lista.filter((k) => !atuais.has(k)).length;
        if (visiveis <= 1) return;
        proximo.add(chave);
      }

      aplicar(proximo);
      if (tabela) {
        conhecidasRef.current = new Set(lista);
        void salvarColunasOcultas(tabela, [...proximo], lista);
      }
    },
    [tabela, chaveEstavel, fixasEstavel, aplicar],
  );

  /** Volta ao padrão (`defaultHidden`) e apaga a preferência do navegador. */
  const restaurar = useCallback(() => {
    aplicar(
      manterUmaVisivel(new Set(padrao), comoChaves(chaveEstavel)),
    );

    if (!tabela) return;

    tabelaCarregadaRef.current = tabela;
    conhecidasRef.current = new Set(comoChaves(chaveEstavel));
    void limparColunasOcultas(tabela);
  }, [tabela, chaveEstavel, padrao, aplicar]);

  return { ocultas, alternar, restaurar, carregado };
}
