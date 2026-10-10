"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import DestinatarioForm from "./novo/DestinatarioForm";
import type { Column, Action } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import {
  listarDestinatarios,
  getDestinatario,
  deleteDestinatario,
  type DestinatarioListRow,
  type DestinatarioFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<DestinatarioListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<DestinatarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "razao", label: "Razão Social", width: "5fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function DestinatariosClient({ inicial, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<DestinatarioFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DestinatarioListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const mostrarAviso = useAviso();
  const { resultado, carregando, buscarPorTermo, irParaPagina, mudarTamanho } =
    useListaPaginada(listarDestinatarios, inicial);

  async function openModal(id: number | null, mode: "edit" | "view") {
    if (id === null) { setModalMode("create"); return; }
    const data = await getDestinatario(id);
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
      const result = await deleteDestinatario(deleteTarget.id_destinatario);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Destinatário excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao excluir. Tente novamente.", "erro");
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<DestinatarioListRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: DestinatarioListRow) => openModal(row.id_destinatario, "view"),
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: DestinatarioListRow) => openModal(row.id_destinatario, "edit"),
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: DestinatarioListRow) => setDeleteTarget(row),
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar destinatários..."
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
        <DestinatarioForm mode="create" tiposCodigo={tiposCodigo} onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="960px">
        {formData && (
          <DestinatarioForm
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
          <DestinatarioForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir destinatário"
        message={`Tem certeza que deseja excluir "${deleteTarget?.razao}"?`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}