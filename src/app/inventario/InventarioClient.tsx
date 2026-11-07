"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type Action, type Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchBar from "@/components/SearchBar";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import { useAviso } from "@/components/AvisoProvider";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import { STATUS_INVENTARIO, type PaginatedResult } from "@/types";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import {
  excluirInventario,
  getInventario,
  listarInventarios,
  type InventarioDetalhe,
  type InventarioListRow,
} from "./actions";
import InventarioForm from "./InventarioForm";

type Props = {
  inicial: PaginatedResult<InventarioListRow>;
  podeAbrir: boolean;
};

function formatarData(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR");
}

const statusCls: Record<string, string> = {
  ABERTO: "bg-[#e8f0fe] text-[#001d6c]",
  EM_CONTAGEM: "bg-[#fff4e5] text-[#7a4100]",
  AGUARDANDO_APROVACAO: "bg-[#f3e8ff] text-[#5b1a8a]",
  FINALIZADO: "bg-[#e7f6ec] text-[#0f5132]",
  CANCELADO: "bg-[#f2f4f8] text-[#4a4f55]",
};

const ROTULOS_STATUS_INVENTARIO: Record<(typeof STATUS_INVENTARIO)[number], string> = {
  ABERTO: "Aberto",
  EM_CONTAGEM: "Em contagem",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

const columns: Column<InventarioListRow>[] = [
  {
    key: "observacao",
    label: "Observação",
    width: "3fr",
    align: "left",
    render: (value) => String(value ?? ""),
  },
  {
    key: "data_inicio",
    label: "Data",
    width: "1fr",
    align: "center",
    render: (value) => formatarData(String(value ?? "")),
  },
  {
    key: "status_label",
    label: "Status",
    width: "1.25fr",
    align: "center",
    render: (_value, row) => (
      <span
        className={`inline-flex rounded-full px-3 py-1 font-sans text-xs font-semibold ${
          statusCls[row.status] ?? "bg-[#f2f4f8] text-ink"
        }`}
      >
        {row.status_label}
      </span>
    ),
  },
  {
    key: "produtos",
    label: "Produtos",
    width: "0.8fr",
    align: "right",
    render: (value) => String(value ?? 0),
  },
  {
    key: "contados",
    label: "Contados",
    width: "0.9fr",
    align: "right",
    render: (_value, row) => `${row.contados}/${row.produtos}`,
  },
];

export default function InventarioClient({ inicial, podeAbrir }: Props) {
  const router = useRouter();
  const mostrarAviso = useAviso();
  const lista = useListaPaginada(listarInventarios, inicial);
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<InventarioDetalhe | null>(null);
  const [excluindo, setExcluindo] = useState<InventarioListRow | null>(null);
  const [processando, setProcessando] = useState(false);

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    { id: "periodo", rotulo: "Data de início", tipo: "periodo" },
    {
      id: "status",
      rotulo: "Status",
      tipo: "multi",
      opcoes: STATUS_INVENTARIO.map((status) => ({
        valor: status,
        rotulo: ROTULOS_STATUS_INVENTARIO[status],
      })),
    },
    { id: "contagemCega", rotulo: "Contagem cega", tipo: "checkbox" },
  ];

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);

    const periodo = Array.isArray(novos.periodo) ? undefined : novos.periodo;
    const status = novos.status;
    const cega = novos.contagemCega;
    lista.aplicarFiltros({
      status: Array.isArray(status) && status.length > 0 ? status : undefined,
      de: periodo?.de || undefined,
      ate: periodo?.ate || undefined,
      contagemCega: Array.isArray(cega) && cega.length > 0 ? true : undefined,
    });
  }

  function limparFiltrosTela() {
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    lista.aplicarFiltros({});
  }

  const actions: Action<InventarioListRow>[] = [
    {
      icon: "/icons/actions/Olho.svg",
      label: "Consultar",
      onClick: (row) => router.push(`/inventario/${row.id_inventario}`),
    },
    ...(podeAbrir
      ? [
          {
            icon: "/icons/actions/Editar.svg",
            label: "Editar",
            onClick: async (row: InventarioListRow) => {
              if (!row.podeEditar) {
                mostrarAviso("Só é possível editar antes da primeira contagem.", "cautela");
                return;
              }
              const detalhe = await getInventario(row.id_inventario);
              if (!detalhe) {
                mostrarAviso("Inventário não encontrado.", "erro");
                return;
              }
              setEditando(detalhe);
            },
          },
        ]
      : []),
    ...(podeAbrir
      ? [
          {
            icon: "/icons/actions/Lixeira.svg",
            label: "Excluir",
            onClick: (row: InventarioListRow) => {
              if (!row.podeExcluir) {
                mostrarAviso(
                  "Não é possível excluir: o inventário já possui contagem ou não está aberto.",
                  "cautela",
                );
                return;
              }
              setExcluindo(row);
            },
          },
        ]
      : []),
  ];

  async function confirmarExclusao() {
    if (!excluindo) return;
    setProcessando(true);
    try {
      const resultado = await excluirInventario(excluindo.id_inventario);
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Inventário excluído.", "sucesso");
      setExcluindo(null);
      router.refresh();
    } catch {
      mostrarAviso("Não foi possível excluir o inventário.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-figma="InventarioLista">
      <SearchBar
        placeholder="Pesquisar inventários..."
        novoLabel="Novo inventário"
        onNew={() => setNovoAberto(true)}
        onSearch={lista.buscarPorTermo}
        showNew={podeAbrir}
      />

      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltrosTela}
      />

      <DataTable
        columns={columns}
        data={lista.resultado.data}
        idField="id_inventario"
        actions={actions}
        paginacaoServidor={{
          total: lista.resultado.total,
          page: lista.resultado.page,
          pageSize: lista.resultado.limit,
          onPageChange: lista.irParaPagina,
          onPageSizeChange: lista.mudarTamanho,
        }}
        carregando={lista.carregando}
      />

      <Modal
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        title="Novo inventário"
        width="min(820px, calc(100vw - 32px))"
      >
        <InventarioForm
          mode="create"
          onCancel={() => setNovoAberto(false)}
          onSaved={(id) => {
            setNovoAberto(false);
            router.refresh();
            if (id) router.push(`/inventario/${id}`);
          }}
        />
      </Modal>

      <Modal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title="Editar inventário"
        width="min(820px, calc(100vw - 32px))"
      >
        {editando && (
          <InventarioForm
            mode="edit"
            inicial={editando}
            onCancel={() => setEditando(null)}
            onSaved={() => {
              setEditando(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
        title="Excluir inventário"
        message={`Excluir "${excluindo?.observacao ?? ""}"? Esta ação só é permitida antes da primeira contagem.`}
        confirmLabel="Excluir"
        loading={processando}
      />
    </div>
  );
}
