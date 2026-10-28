"use client";

import { useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataTable, { type Column } from "@/components/DataTable";
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
  const [escola, setEscola] = useState(filtros.escola);
  const [status, setStatus] = useState(filtros.status);
  const [de, setDe] = useState(filtros.de);
  const [ate, setAte] = useState(filtros.ate);
  const [produto, setProduto] = useState(filtros.produto);
  const [nota, setNota] = useState(filtros.nota);
  const [analisando, setAnalisando] = useState<number | null>(null);
  const [recusando, setRecusando] = useState<PedidoListRow | null>(null);

  function parametros(page = 1, limit = resultado.limit): PedidoFiltrosPayload {
    return {
      page,
      limit,
      search: busca.trim() || undefined,
      id_destinatario: escola ? Number(escola) : null,
      status: status || null,
      de: de || null,
      ate: ate || null,
      id_produto: produto ? Number(produto) : null,
      com_nota: (nota as "todos" | "com" | "sem") || "todos",
    };
  }

  async function carregar(page = 1, limit = resultado.limit) {
    setCarregando(true);
    try {
      setResultado(await listarPedidos(parametros(page, limit)));
    } finally {
      setCarregando(false);
    }
  }

  function limparFiltros() {
    setBusca("");
    setEscola("");
    setStatus("");
    setDe("");
    setAte("");
    setProduto("");
    setNota("todos");
    void (async () => {
      setCarregando(true);
      try {
        setResultado(await listarPedidos({ page: 1, limit: resultado.limit }));
      } finally {
        setCarregando(false);
      }
    })();
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

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          Escola
          <select
            value={escola}
            onChange={(e) => setEscola(e.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="">Todas</option>
            {escolas.map((opcao) => (
              <option key={opcao.id_destinatario} value={opcao.id_destinatario}>
                {opcao.razao_social}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="CONFIRMADO">Aprovado</option>
            <option value="RECUSADO">Recusado</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          Produto
          <select
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="">Todos</option>
            {produtos.map((opcao) => (
              <option key={opcao.id_produto} value={opcao.id_produto}>
                {opcao.codigo} - {opcao.descricao}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          De
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className={CLASSE_CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className={CLASSE_CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1 font-sans text-xs text-[#697077]">
          Nota
          <select
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="todos">Com ou sem</option>
            <option value="com">Com nota</option>
            <option value="sem">Sem nota</option>
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button label="Limpar" variant="ghost" onClick={limparFiltros} />
          <Button
            label="Filtrar"
            variant="primary"
            onClick={() => void carregar(1)}
            disabled={carregando}
          />
          {podeCriar && (
            <Button label="Novo pedido" href="/pedidos/novo" />
          )}
        </div>
      </div>

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
