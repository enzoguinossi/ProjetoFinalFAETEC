"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import ProdutoForm from "./novo/ProdutoForm";
import ProdutoView from "./novo/ProdutoView";
import type { Column, Action } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import {
  listarProdutos,
  getProduto,
  deleteProduto,
  type ProdutoListRow,
  type ProdutoFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<ProdutoListRow>;
  conversoes: { id_conversao: number; nome: string; fator: number; descricao: string | null }[];
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<ProdutoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "qtd", label: "Quantidade", width: "1fr" },
  { key: "livre", label: "Qtd. Livre", width: "1fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function ProdutosClient({ inicial, conversoes, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<ProdutoFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdutoListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const mostrarAviso = useAviso();
  const { resultado, carregando, buscarPorTermo, irParaPagina, mudarTamanho } =
    useListaPaginada(listarProdutos, inicial);

  async function openEdit(id: number) {
    const data = await getProduto(id);
    setFormData(data);
    setModalMode("edit");
  }

  async function openView(id: number) {
    const data = await getProduto(id);
    setFormData(data);
    setModalMode("view");
  }

  function closeModal() {
    setModalMode(null);
    setFormData(null);
  }

  function handleSuccess() {
    closeModal();
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteProduto(deleteTarget.id_produto);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Produto excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao excluir. Tente novamente.", "erro");
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<ProdutoListRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: ProdutoListRow) => openView(row.id_produto),
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: ProdutoListRow) => openEdit(row.id_produto),
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: ProdutoListRow) => setDeleteTarget(row),
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
        onNew={() => setModalMode("create")}
        onSearch={buscarPorTermo}
        showNew={perms.canCreate}
      />
      <DataTable
        columns={columns}
        data={resultado.data}
        idField="codigo"
        actions={actions}
        paginacaoServidor={{
          total: resultado.total,
          page: resultado.page,
          pageSize: resultado.limit,
          onPageChange: irParaPagina,
          onPageSizeChange: mudarTamanho,
        }}
        carregando={carregando}
      />

      <Modal
        open={modalMode === "create"}
        onClose={closeModal}
        width="728px"
      >
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          onSuccess={handleSuccess}
          onCancel={closeModal}
        />
      </Modal>

      <Modal
        open={modalMode === "edit" && formData !== null}
        onClose={closeModal}
        width="728px"
      >
        {formData && (
          <ProdutoForm
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={handleSuccess}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal
        open={modalMode === "view" && formData !== null}
        onClose={closeModal}
        width="728px"
      >
        {formData && (
          <ProdutoView
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            data={formData}
            onClose={closeModal}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}