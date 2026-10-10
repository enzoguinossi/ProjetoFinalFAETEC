"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import FornecedorForm from "./novo/FornecedorForm";
import type { Column, Action } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import {
  listarFornecedores,
  getFornecedor,
  deleteFornecedor,
  type FornecedorListRow,
  type FornecedorFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<FornecedorListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<FornecedorListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "razao", label: "Razão Social", width: "5fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function FornecedoresClient({ inicial, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<FornecedorFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FornecedorListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const mostrarAviso = useAviso();
  const { resultado, carregando, buscarPorTermo, irParaPagina, mudarTamanho } =
    useListaPaginada(listarFornecedores, inicial);

  async function openModal(id: number | null, mode: "edit" | "view") {
    if (id === null) { setModalMode("create"); return; }
    const data = await getFornecedor(id);
    setFormData(data);
    setModalMode(mode);
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
      const result = await deleteFornecedor(deleteTarget.id_fornecedor);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Fornecedor excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao excluir. Tente novamente.", "erro");
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<FornecedorListRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: FornecedorListRow) => openModal(row.id_fornecedor, "view"),
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: FornecedorListRow) => openModal(row.id_fornecedor, "edit"),
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: FornecedorListRow) => setDeleteTarget(row),
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar fornecedores..."
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

      <Modal open={modalMode === "create"} onClose={closeModal} width="960px">
        <FornecedorForm mode="create" tiposCodigo={tiposCodigo} onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="960px">
        {formData && (
          <FornecedorForm
            mode="edit"
            initialData={formData}
            tiposCodigo={tiposCodigo}
            canDeactivate={perms.canDeactivate}
            onSuccess={handleSuccess}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="960px">
        {formData && (
          <FornecedorForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir "${deleteTarget?.razao}"?`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}