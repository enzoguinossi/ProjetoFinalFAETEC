"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataTable, { type Column } from "@/components/DataTable";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo } from "@/lib/formatar";
import type { PaginatedResult } from "@/types";
import {
  aprovarPedido,
  listarPedidos,
  recusarPedido,
  type EscolaSelecaoRow,
  type PedidoFiltrosPayload,
  type PedidoListRow,
} from "./actions";

export type ProdutoFiltro = {
  id_produto: number;
  codigo: string;
  descricao: string;
};

export type FiltrosIniciais = {
  busca: string;
  escola: string;
  status: string;
  de: string;
  ate: string;
  produto: string;
  nota: string;
};

interface Props {
  inicial: PaginatedResult<PedidoListRow>;
  escolas: EscolaSelecaoRow[];
  produtos: ProdutoFiltro[];
  filtros: FiltrosIniciais;
  podeCriar: boolean;
  podeAlterar: boolean;
  podeAprovar: boolean;
  podeConsultar: boolean;
}

const CLASSE_CAMPO =
  "h-10 rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-ink outline-none focus:border-brand";

const STATUS_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "CONFIRMADO", rotulo: "Aprovado" },
  { valor: "RECUSADO", rotulo: "Recusado" },
];

const NOTA_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "com", rotulo: "Com nota" },
  { valor: "sem", rotulo: "Sem nota" },
];

/** Números inteiros positivos, sem duplicatas; vazio vira `undefined`. */
function idsNumericos(
  valores: string[] | { de: string; ate: string } | undefined,
): number[] | undefined {
  if (!Array.isArray(valores)) return undefined;
  const ids = valores
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

const statusCls: Record<string, string> = {
  PENDENTE: "bg-[#fff4e5] text-[#7a4100]",
  CONFIRMADO: "bg-[#e7f6ec] text-[#0f5132]",
  RECUSADO: "bg-[#fdecea] text-[#8a1c1c]",
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default function PedidosClient({
  inicial,
  escolas,
  produtos,
  filtros,
  podeCriar,
  podeAlterar,
  podeAprovar,
  podeConsultar,
}: Props) {
  const mostrarAviso = useAviso();

  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState(filtros.busca);
  const [analisando, setAnalisando] = useState<number | null>(null);
  const [recusando, setRecusando] = useState<PedidoListRow | null>(null);

  const valoresIniciais: Valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    escola: filtros.escola ? [filtros.escola] : [],
    status: filtros.status ? [filtros.status] : [],
    produto: filtros.produto ? [filtros.produto] : [],
    nota: filtros.nota && filtros.nota !== "todos" ? [filtros.nota] : [],
  };
  const [valoresFiltros, setValoresFiltros] = useState<Valores>(valoresIniciais);
  const [chaveFiltros, setChaveFiltros] = useState(0);
  const filtrosAtuais = useRef<Valores>(valoresIniciais);

  const camposFiltro: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "escola",
      rotulo: "Escola",
      tipo: "multi",
      opcoes: escolas.map((escola) => ({
        valor: String(escola.id_destinatario),
        rotulo: escola.razao_social,
      })),
    },
    { id: "status", rotulo: "Status", tipo: "multi", opcoes: STATUS_FILTRO },
    {
      id: "produto",
      rotulo: "Produto",
      tipo: "multi",
      opcoes: produtos.map((produto) => ({
        valor: String(produto.id_produto),
        rotulo: `${produto.codigo} - ${produto.descricao}`,
      })),
    },
    { id: "nota", rotulo: "Nota", tipo: "multi", opcoes: NOTA_FILTRO },
  ];

  function parametros(
    page = 1,
    limit = resultado.limit,
    valores = filtrosAtuais.current,
    termo = busca,
  ): PedidoFiltrosPayload {
    const periodo = Array.isArray(valores.periodo) ? undefined : valores.periodo;
    const status = Array.isArray(valores.status) ? valores.status : [];
    const nota = Array.isArray(valores.nota) ? valores.nota : [];

    return {
      page,
      limit,
      search: termo.trim() || undefined,
      id_destinatario: idsNumericos(valores.escola),
      status: status.length > 0 ? status : null,
      de: periodo?.de || null,
      ate: periodo?.ate || null,
      id_produto: idsNumericos(valores.produto),
      com_nota:
        nota.length === 1 && (nota[0] === "com" || nota[0] === "sem")
          ? nota[0]
          : "todos",
    };
  }

  async function carregar(
    page = 1,
    limit = resultado.limit,
    valores = filtrosAtuais.current,
    termo = busca,
  ) {
    setCarregando(true);
    try {
      setResultado(await listarPedidos(parametros(page, limit, valores, termo)));
    } finally {
      setCarregando(false);
    }
  }

  function aplicarFiltrosTela(novos: Valores) {
    filtrosAtuais.current = novos;
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    void carregar(1, resultado.limit, novos);
  }

  function limparFiltros() {
    setBusca("");
    filtrosAtuais.current = {};
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    void carregar(1, resultado.limit, {}, "");
  }

  async function aprovar(id: number) {
    setAnalisando(id);
    try {
      const resposta = await aprovarPedido(id);
      if ("error" in resposta) {
        mostrarAviso(resposta.error, "erro");
        return;
      }
      mostrarAviso("Pedido aprovado e disponível para importar na Saída.", "sucesso");
      await carregar(resultado.page, resultado.limit);
    } finally {
      setAnalisando(null);
    }
  }

  async function recusar() {
    if (!recusando) return;
    setAnalisando(recusando.id_pedido_escola);
    try {
      const resposta = await recusarPedido(recusando.id_pedido_escola);
      if ("error" in resposta) {
        mostrarAviso(resposta.error, "erro");
        return;
      }
      mostrarAviso("Pedido recusado.", "sucesso");
      setRecusando(null);
      await carregar(resultado.page, resultado.limit);
    } finally {
      setAnalisando(null);
    }
  }

  const columns: Column<PedidoListRow>[] = [
    {
      key: "codigo",
      label: "Código",
      width: "0.8fr",
      align: "center",
      render: (value) => formatarCodigo(Number(value)),
    },
    { key: "data", label: "Data", width: "0.9fr", align: "center" },
    { key: "escola", label: "Escola", width: "2.6fr" },
    {
      key: "total",
      label: "Itens",
      width: "0.8fr",
      align: "right",
      render: (_value, row) =>
        `${row.itens.length} · ${formatarQuantidade(row.total)}`,
    },
    {
      key: "statusLabel",
      label: "Status",
      width: "1fr",
      align: "center",
      render: (value, row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            statusCls[row.status] ?? "bg-[#f2f4f8] text-[#4a4f55]"
          }`}
        >
          {String(value)}
        </span>
      ),
    },
    {
      key: "nota",
      label: "Nota",
      width: "0.7fr",
      align: "center",
      render: (value) =>
        value === null ? "—" : formatarCodigo(Number(value)),
    },
    {
      key: "podeEditar",
      label: "Ações",
      width: "17rem",
      align: "center",
      render: (_value, row) => (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {podeConsultar && (
            <Button
              label="Ver"
              variant="ghost"
              href={`/pedidos/${row.id_pedido_escola}`}
            />
          )}
          {podeAlterar && row.podeEditar && (
            <Button
              label="Editar"
              variant="ghost"
              href={`/pedidos/${row.id_pedido_escola}/editar`}
            />
          )}
          {podeAprovar && row.podeAnalisar && (
            <>
              <Button
                label={analisando === row.id_pedido_escola ? "..." : "Aprovar"}
                onClick={() => void aprovar(row.id_pedido_escola)}
                disabled={analisando !== null}
              />
              <Button
                label="Recusar"
                variant="cancel"
                onClick={() => setRecusando(row)}
                disabled={analisando !== null}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 font-sans text-xs text-[#697077]">
          Buscar
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void carregar(1);
              }
            }}
            placeholder="Escola, produto ou observação"
            className={CLASSE_CAMPO}
          />
        </label>
      </div>

      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltros}
        acoes={
          podeCriar ? <Button label="Novo pedido" href="/pedidos/novo" /> : undefined
        }
      />

      <DataTable
        columns={columns}
        data={resultado.data}
        idField="id_pedido_escola"
        rowExpansivel={(row) => row.itens.length > 0}
        renderExpandido={(row) => (
          <div className="flex flex-col gap-1">
            {row.itens.map((item) => (
              <span key={item.id_produto} className="font-sans text-sm text-ink">
                {item.codigo} — {item.descricao}:{" "}
                {formatarQuantidade(item.quantidade)}
              </span>
            ))}
          </div>
        )}
        paginacaoServidor={{
          total: resultado.total,
          page: resultado.page,
          pageSize: resultado.limit,
          onPageChange: (page) => void carregar(page, resultado.limit),
          onPageSizeChange: (limit) => void carregar(1, limit),
        }}
        carregando={carregando}
      />

      <ConfirmDialog
        open={recusando !== null}
        onClose={() => setRecusando(null)}
        onConfirm={() => void recusar()}
        title="Recusar pedido"
        message={
          recusando
            ? `Recusar o pedido ${recusando.codigo} (${recusando.escola})? Ele permanece no histórico.`
            : ""
        }
        confirmLabel="Recusar"
        loading={analisando !== null}
      />
    </div>
  );
}
