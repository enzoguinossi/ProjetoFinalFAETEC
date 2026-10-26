"use client";

import { useId, useMemo, useState } from "react";
import Switch from "@/components/Switch";

export interface PermissaoOption {
  id_permissao: number;
  nome: string;
  descricao: string | null;
}

export interface GrupoPermissoes {
  prefixo: string;
  permissoes: PermissaoOption[];
}

interface Props {
  grupos: GrupoPermissoes[];
  selecionadas: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  tituloDisponiveis?: string;
  tituloSelecionadas?: string;
  /** Renderiza o botão + slot de ações (ex.: "Aplicar perfil"). */
  acoes?: React.ReactNode;
}

const ROTULOS_GRUPO: Record<string, string> = {
  usuario: "Usuários",
  funcionario: "Funcionários",
  destinatario: "Destinatários",
  fornecedor: "Fornecedores",
  veiculo: "Veículos",
  produto: "Produtos",
  perfil: "Perfis",
  unidade_conversao: "Unidades de conversão",
  estoque: "Estoque",
  nota_entrada: "Notas de entrada",
  nota_saida: "Notas de saída",
  expedicao: "Expedições",
  percurso: "Percursos",
  inventario: "Inventário",
  relatorio: "Relatórios",
  mural: "Mural",
};

const ROTULOS_ACAO: Record<string, string> = {
  listar: "Listar",
  criar: "Criar",
  alterar: "Alterar",
  consultar: "Consultar",
  desativar: "Desativar",
  excluir: "Excluir",
  entrada: "Registrar entrada",
  saida: "Registrar saída",
  ver_saldo: "Ver saldo",
  cancelar: "Cancelar",
  alterar_status: "Alterar status",
  finalizar: "Finalizar",
  abrir: "Abrir",
  contar: "Contar",
  aprovar_ajuste: "Aprovar ajuste",
  ver_contagem_cega: "Ver contagem cega",
  gerar: "Gerar",
};

function capitalizar(texto: string): string {
  return texto.length === 0 ? texto : texto[0].toUpperCase() + texto.slice(1);
}

function humanizar(texto: string): string {
  return capitalizar(texto.replace(/_/g, " "));
}

function rotuloGrupo(prefixo: string): string {
  return ROTULOS_GRUPO[prefixo] ?? humanizar(prefixo);
}

function acaoDaPermissao(nome: string): string {
  const partes = nome.split(".");
  return partes.slice(1).join(".") || partes[0] || nome;
}

function rotuloAcao(nome: string): string {
  const acao = acaoDaPermissao(nome);
  return ROTULOS_ACAO[acao] ?? humanizar(acao);
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type GrupoView = {
  prefixo: string;
  label: string;
  permissoes: PermissaoOption[];
  nomes: string[];
};

export default function PermissoesPanel({
  grupos,
  selecionadas,
  onChange,
  disabled = false,
  tituloSelecionadas = "Selecionadas",
  acoes,
}: Props) {
  const buscaId = useId();
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());

  const gruposView = useMemo<GrupoView[]>(
    () =>
      grupos
        .map((grupo) => ({
          prefixo: grupo.prefixo,
          label: rotuloGrupo(grupo.prefixo),
          permissoes: [...grupo.permissoes].sort((a, b) =>
            rotuloAcao(a.nome).localeCompare(rotuloAcao(b.nome), "pt-BR"),
          ),
          nomes: grupo.permissoes.map((permissao) => permissao.nome),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [grupos],
  );

  const todasDisponiveis = useMemo(
    () => gruposView.flatMap((grupo) => grupo.nomes),
    [gruposView],
  );
  const conjuntoDisponivel = useMemo(() => new Set(todasDisponiveis), [todasDisponiveis]);
  const selecionadasValidas = useMemo(
    () => selecionadas.filter((nome) => conjuntoDisponivel.has(nome)),
    [selecionadas, conjuntoDisponivel],
  );
  const selecionadasSet = useMemo(
    () => new Set(selecionadasValidas),
    [selecionadasValidas],
  );

  const termo = normalizar(busca.trim());

  const gruposFiltrados = useMemo(() => {
    if (!termo) {
      return gruposView.map((grupo) => ({ ...grupo, permissoesVisiveis: grupo.permissoes }));
    }
    return gruposView.flatMap((grupo) => {
      const grupoCombina = normalizar(grupo.label).includes(termo);
      const permissoesVisiveis = grupoCombina
        ? grupo.permissoes
        : grupo.permissoes.filter((permissao) => {
            return (
              normalizar(permissao.nome).includes(termo) ||
              normalizar(rotuloAcao(permissao.nome)).includes(termo) ||
              normalizar(permissao.descricao ?? "").includes(termo)
            );
          });
      return permissoesVisiveis.length > 0 ? [{ ...grupo, permissoesVisiveis }] : [];
    });
  }, [gruposView, termo]);

  function aplicar(nomes: string[]) {
    if (disabled) return;
    onChange(nomes);
  }

  function alternarPermissao(nome: string, ativo: boolean) {
    const proximo = new Set(selecionadasValidas);
    if (ativo) proximo.add(nome);
    else proximo.delete(nome);
    aplicar(todasDisponiveis.filter((item) => proximo.has(item)));
  }

  function alternarGrupo(grupo: GrupoView) {
    const todasMarcadas = grupo.nomes.every((nome) => selecionadasSet.has(nome));
    const proximo = new Set(selecionadasValidas);
    if (todasMarcadas) {
      grupo.nomes.forEach((nome) => proximo.delete(nome));
    } else {
      grupo.nomes.forEach((nome) => proximo.add(nome));
    }
    aplicar(todasDisponiveis.filter((nome) => proximo.has(nome)));
  }

  function alternarAberto(prefixo: string) {
    setAbertos((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(prefixo)) proximo.delete(prefixo);
      else proximo.add(prefixo);
      return proximo;
    });
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      data-figma="PermissoesPanel"
      data-figma-selecionadas={selecionadasValidas.length}
      data-figma-total={todasDisponiveis.length}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 font-display text-lg font-[590] text-ink-strong">
            Permissões
          </h3>
          <p className="m-0 font-sans text-xs text-[#697077]" aria-live="polite">
            <span className="font-semibold text-ink">
              {selecionadasValidas.length} de {todasDisponiveis.length}
            </span>{" "}
            · {tituloSelecionadas}
          </p>
        </div>
        {acoes && <div className="shrink-0">{acoes}</div>}
      </div>

      <label htmlFor={buscaId} className="sr-only">
        Pesquise pelo nome da permissão
      </label>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-border-input bg-white px-3 transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 text-[#697077]"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id={buscaId}
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Pesquise pelo nome da permissão"
          className="min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-ink outline-none placeholder:text-[#8a8f9a]"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            aria-label="Limpar busca de permissões"
            title="Limpar busca"
            className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-transparent text-[#697077] cursor-pointer hover:bg-[#f2f4f8]"
          >
            ×
          </button>
        )}
      </div>

      <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-border">
        {gruposFiltrados.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center font-sans text-sm text-[#697077]">
            Nenhuma permissão encontrada.
          </p>
        ) : (
          gruposFiltrados.map((grupo) => {
            const marcadas = grupo.nomes.filter((nome) => selecionadasSet.has(nome)).length;
            const todas = marcadas === grupo.nomes.length && grupo.nomes.length > 0;
            const parcial = marcadas > 0 && !todas;
            const aberto = termo ? true : abertos.has(grupo.prefixo);

            return (
              <div
                key={grupo.prefixo}
                className="border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-[#f7f9fb]">
                  <button
                    type="button"
                    onClick={() => alternarAberto(grupo.prefixo)}
                    aria-expanded={aberto}
                    aria-label={`${aberto ? "Recolher" : "Expandir"} ${grupo.label}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-[#5f6b7a] cursor-pointer hover:bg-[#eef2f6]"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                      className={`transition-transform duration-150 ${aberto ? "rotate-90" : ""}`}
                    >
                      <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => alternarAberto(grupo.prefixo)}
                    className="flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent p-0 text-left cursor-pointer"
                  >
                    <span className="truncate font-sans text-sm font-semibold text-ink-strong">
                      {grupo.label}
                    </span>
                    <span className="shrink-0 font-sans text-xs text-[#697077]">
                      {marcadas}/{grupo.nomes.length}
                    </span>
                  </button>

                  <Switch
                    checked={todas}
                    partial={parcial}
                    disabled={disabled}
                    onChange={() => alternarGrupo(grupo)}
                    ariaLabel={`Selecionar todas as permissões de ${grupo.label}`}
                  />
                </div>

                {aberto && (
                  <ul className="m-0 list-none divide-y divide-[#edf0f3] border-t border-[#edf0f3] bg-[#fbfcfd] p-0">
                    {grupo.permissoesVisiveis.map((permissao) => {
                      const ativa = selecionadasSet.has(permissao.nome);
                      return (
                        <li
                          key={permissao.nome}
                          className="flex items-center gap-3 px-4 py-2 pl-11"
                          title={permissao.descricao ?? permissao.nome}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-sans text-sm text-ink">
                              {rotuloAcao(permissao.nome)}
                            </span>
                            <span className="truncate font-sans text-[0.6875rem] text-[#8a8f9a]">
                              {permissao.descricao ?? permissao.nome}
                            </span>
                          </span>
                          <Switch
                            checked={ativa}
                            disabled={disabled}
                            onChange={(proximo) => alternarPermissao(permissao.nome, proximo)}
                            ariaLabel={`${ativa ? "Remover" : "Adicionar"} permissão ${rotuloAcao(permissao.nome)} em ${grupo.label}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="m-0 font-sans text-[0.6875rem] text-[#8a8f9a]">
        O switch do grupo marca ou desmarca todas as permissões. Use a busca para encontrar
        uma ação específica.
      </p>
    </section>
  );
}
