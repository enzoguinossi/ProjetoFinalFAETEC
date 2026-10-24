"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type OpcaoFiltro = { valor: string; rotulo: string };

export type CampoFiltro =
  | { id: string; rotulo: string; tipo: "multi"; opcoes: OpcaoFiltro[] }
  | { id: string; rotulo: string; tipo: "periodo" };

/** Seleção atual de cada campo: lista de valores (multi) ou período de/até. */
export type Valores = Record<string, string[] | { de: string; ate: string }>;

interface BarraFiltrosProps {
  /** Caminho da tela, sem query (ex.: `/relatorios/movimentacao`). */
  basePath: string;
  campos: CampoFiltro[];
  /** Seleção atual vinda da URL (já normalizada pelo servidor). */
  valores: Valores;
}

/* ------------------------------------------------------------------ */
/* Datas no fuso de São Paulo (o período é sempre um dia local).       */
/* ------------------------------------------------------------------ */

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function periodoMesAtual(): { de: string; ate: string } {
  const [ano, mes] = hojeSaoPaulo().split("-").map(Number);
  const mesTexto = String(mes).padStart(2, "0");
  return {
    de: `${ano}-${mesTexto}-01`,
    ate: `${ano}-${mesTexto}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, "0")}`,
  };
}

function periodoSemestreAtual(): { de: string; ate: string } {
  const [ano, mes] = hojeSaoPaulo().split("-").map(Number);
  const inicio = mes <= 6 ? 1 : 7;
  const fim = inicio + 5;
  const mesTexto = (valor: number) => String(valor).padStart(2, "0");
  return {
    de: `${ano}-${mesTexto(inicio)}-01`,
    ate: `${ano}-${mesTexto(fim)}-${String(ultimoDiaDoMes(ano, fim)).padStart(2, "0")}`,
  };
}

function formatarDataBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* ------------------------------------------------------------------ */
/* Ícones (SVG inline: nenhuma dependência nova).                      */
/* ------------------------------------------------------------------ */

function IconeCalendario() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconeFiltro() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path
        d="M2.5 4h11M4.5 8h7M6.5 12h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeChevron() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeX() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeCheck() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path d="m3 8.5 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

function copiar(valores: Valores): Valores {
  const copia: Valores = {};
  for (const [chave, valor] of Object.entries(valores)) {
    copia[chave] = Array.isArray(valor) ? [...valor] : { ...valor };
  }
  return copia;
}

function vazio(campo: CampoFiltro): string[] | { de: string; ate: string } {
  return campo.tipo === "multi" ? [] : { de: "", ate: "" };
}

export default function BarraFiltros({ basePath, campos, valores }: BarraFiltrosProps) {
  const router = useRouter();
  const raiz = useRef<HTMLDivElement>(null);

  // A URL é a fonte de verdade: a página remonta o componente (via `key`)
  // quando os filtros normalizados mudam.
  const [selecao, setSelecao] = useState<Valores>(() => copiar(valores));
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  // Fecha o painel ao clicar fora e com Esc.
  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(null);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(null);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function temValor(campo: CampoFiltro): boolean {
    const valor = selecao[campo.id];
    if (!valor) return false;
    if (campo.tipo === "multi") {
      return Array.isArray(valor) && valor.length > 0;
    }
    return !Array.isArray(valor) && Boolean(valor.de || valor.ate);
  }

  const visiveis = campos.filter(
    (campo) => temValor(campo) || adicionados.includes(campo.id),
  );
  const disponiveis = campos.filter((campo) => !visiveis.includes(campo));
  const quantidadeAtiva = visiveis.filter(temValor).length;

  function alterar(campo: CampoFiltro, valor: string[] | { de: string; ate: string }) {
    setSelecao((atual) => ({ ...atual, [campo.id]: valor }));
  }

  function alternarOpcao(campo: Extract<CampoFiltro, { tipo: "multi" }>, valor: string) {
    const atuais = selecao[campo.id];
    const lista = Array.isArray(atuais) ? atuais : [];
    alterar(
      campo,
      lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor],
    );
  }

  function remover(campo: CampoFiltro) {
    alterar(campo, vazio(campo));
    setAdicionados((atuais) => atuais.filter((id) => id !== campo.id));
    setAberto(null);
  }

  function adicionar(campo: CampoFiltro) {
    setAdicionados((atuais) => (atuais.includes(campo.id) ? atuais : [...atuais, campo.id]));
    setAberto(campo.id);
  }

  function aplicar() {
    const params = new URLSearchParams();
    for (const campo of campos) {
      const valor = selecao[campo.id];
      if (!valor) continue;
      if (campo.tipo === "multi") {
        const lista = Array.isArray(valor) ? valor : [];
        if (lista.length > 0) params.set(campo.id, lista.join(","));
      } else if (!Array.isArray(valor)) {
        if (valor.de) params.set("de", valor.de);
        if (valor.ate) params.set("ate", valor.ate);
      }
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
    setAberto(null);
  }

  function limpar() {
    const nova: Valores = {};
    for (const campo of campos) {
      // O período sempre volta ao padrão do relatório (mês corrente).
      nova[campo.id] = campo.tipo === "multi" ? [] : periodoMesAtual();
    }
    setSelecao(nova);
    setAdicionados([]);
    setAberto(null);
    router.push(basePath);
  }

  function resumo(campo: CampoFiltro): { texto: string; titulo?: string } {
    const valor = selecao[campo.id];
    if (campo.tipo === "periodo") {
      const periodo = Array.isArray(valor) ? { de: "", ate: "" } : (valor ?? { de: "", ate: "" });
      if (periodo.de && periodo.ate) {
        return {
          texto: `${formatarDataBr(periodo.de)} – ${formatarDataBr(periodo.ate)}`,
          titulo: `${periodo.de} a ${periodo.ate}`,
        };
      }
      if (periodo.de) return { texto: `a partir de ${formatarDataBr(periodo.de)}` };
      if (periodo.ate) return { texto: `até ${formatarDataBr(periodo.ate)}` };
      return { texto: "Selecionar período" };
    }

    const escolhidos = Array.isArray(valor) ? valor : [];
    if (escolhidos.length === 0) return { texto: "Selecionar" };
    const nomes = escolhidos.map(
      (item) => campo.opcoes.find((opcao) => opcao.valor === item)?.rotulo ?? item,
    );
    if (nomes.length === 1) return { texto: nomes[0], titulo: nomes[0] };
    return { texto: `${nomes.length} selecionados`, titulo: nomes.join(", ") };
  }

  return (
    <div className="flex flex-col gap-3" ref={raiz}>
      <div className="flex flex-wrap items-center gap-2">
        {visiveis.map((campo) => {
          const { texto, titulo } = resumo(campo);
          const ativo = temValor(campo);
          return (
            <div key={campo.id} className="relative">
              <div
                className={`flex h-9 items-center gap-1 rounded-lg border bg-white pl-2.5 pr-1 text-sm ${
                  ativo ? "border-[#1b9956]" : "border-[#c1c7cd]"
                }`}
              >
                <span className={ativo ? "text-brand" : "text-[#697077]"}>
                  {campo.tipo === "periodo" ? <IconeCalendario /> : <IconeFiltro />}
                </span>

                <button
                  type="button"
                  onClick={() => setAberto((atual) => (atual === campo.id ? null : campo.id))}
                  aria-expanded={aberto === campo.id}
                  className="flex max-w-[18rem] items-center gap-1.5 text-sm text-ink"
                >
                  <span className="text-[#697077]">{campo.rotulo}</span>
                  <span
                    className={`max-w-[12rem] truncate ${ativo ? "font-semibold" : "text-[#697077]"}`}
                    title={titulo}
                  >
                    {texto}
                  </span>
                  <span className="text-[#697077]">
                    <IconeChevron />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => remover(campo)}
                  aria-label={`Remover filtro ${campo.rotulo}`}
                  className="rounded p-1 text-[#697077] transition-colors hover:bg-[#f2f4f8] hover:text-ink"
                >
                  <IconeX />
                </button>
              </div>

              {aberto === campo.id ? (
                <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 rounded-xl border border-[#dde1e6] bg-white p-2 shadow-lg">
                  {campo.tipo === "multi" ? (
                    <div className="grid max-h-64 gap-0.5 overflow-y-auto">
                      {campo.opcoes.length === 0 ? (
                        <p className="px-2 py-2 text-sm text-[#697077]">
                          Nenhuma opção disponível.
                        </p>
                      ) : (
                        campo.opcoes.map((opcao) => {
                          const marcado =
                            Array.isArray(selecao[campo.id]) &&
                            (selecao[campo.id] as string[]).includes(opcao.valor);
                          return (
                            <label
                              key={opcao.valor}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-[#f2f4f8]"
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarOpcao(campo, opcao.valor)}
                                className="size-4 accent-[#1b9956]"
                              />
                              <span className="truncate" title={opcao.rotulo}>
                                {opcao.rotulo}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <PeriodoPainel
                      valor={
                        Array.isArray(selecao[campo.id])
                          ? { de: "", ate: "" }
                          : (selecao[campo.id] as { de: string; ate: string })
                      }
                      aoMudar={(periodo) => alterar(campo, periodo)}
                    />
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="relative">
          <button
            type="button"
            onClick={() => setAberto((atual) => (atual === "adicionar" ? null : "adicionar"))}
            aria-expanded={aberto === "adicionar"}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[#c1c7cd] bg-white px-3 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <IconeMais />
            Adicionar filtro
          </button>

          {aberto === "adicionar" ? (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-[#dde1e6] bg-white p-1 shadow-lg">
              {disponiveis.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-[#697077]">
                  Todos os filtros já estão visíveis.
                </p>
              ) : (
                disponiveis.map((campo) => (
                  <button
                    key={campo.id}
                    type="button"
                    onClick={() => adicionar(campo)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-[#f2f4f8]"
                  >
                    {campo.rotulo}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {quantidadeAtiva > 0 ? (
            <button
              type="button"
              onClick={limpar}
              className="h-9 rounded-lg px-3 text-sm font-semibold text-[#697077] transition-colors hover:bg-[#f2f4f8] hover:text-ink"
            >
              Limpar ({quantidadeAtiva})
            </button>
          ) : null}
          <button
            type="button"
            onClick={aplicar}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <IconeCheck />
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

function PeriodoPainel({
  valor,
  aoMudar,
}: {
  valor: { de: string; ate: string };
  aoMudar: (periodo: { de: string; ate: string }) => void;
}) {
  const classeInput =
    "h-9 w-full rounded-lg border border-[#c1c7cd] bg-white px-2 font-sans text-sm text-ink outline-none focus:border-brand";

  return (
    <div className="grid gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-[#697077]">
        De
        <input
          type="date"
          value={valor.de}
          onChange={(evento) => aoMudar({ ...valor, de: evento.target.value })}
          className={classeInput}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#697077]">
        Até
        <input
          type="date"
          value={valor.ate}
          onChange={(evento) => aoMudar({ ...valor, ate: evento.target.value })}
          className={classeInput}
        />
      </label>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <AtalhoPeriodo rotulo="Mês atual" aoEscolher={() => aoMudar(periodoMesAtual())} />
        <AtalhoPeriodo
          rotulo="Semestre atual"
          aoEscolher={() => aoMudar(periodoSemestreAtual())}
        />
      </div>
    </div>
  );
}

function AtalhoPeriodo({ rotulo, aoEscolher }: { rotulo: string; aoEscolher: () => void }) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className="rounded-md border border-[#dde1e6] px-2 py-1 text-xs font-semibold text-brand transition-colors hover:border-brand hover:bg-[rgba(27,153,86,0.06)]"
    >
      {rotulo}
    </button>
  );
}
