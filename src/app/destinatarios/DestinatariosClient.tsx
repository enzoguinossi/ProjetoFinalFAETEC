"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import DestinatarioForm from "./novo/DestinatarioForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchDestinatariosList, type DestinatarioListRow } from "./actions";
import { getDestinatario, deleteDestinatario } from "./novo/actions";
import type { DestinatarioFormData } from "./novo/actions";

interface Props {
  rows: DestinatarioListRow[];
  perms: PermissoesEntidade;
}

const columns: Column<DestinatarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "razao", label: "Razão Social", width: "5fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function DestinatariosClient({ rows: initialRows, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<DestinatarioFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DestinatarioListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const searchRef = useRef("");

  useEffect(() => {
    if (searchRef.current.length < 2) {
      setRows(initialRows);
    }
  }, [initialRows]);

  function handleSearch(value: string) {
    searchRef.current = value;
    if (value.length < 2) {
      setRows(initialRows);
      return;
    }
    searchDestinatariosList(value).then(setRows).catch(() => setRows(initialRows));
  }

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
    window.location.reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteDestinatario(deleteTarget.id_destinatario);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
        window.location.reload();
      }
    } catch {
      setDeleteError("Erro ao excluir. Tente novamente.");
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
          onClick: (row: DestinatarioListRow) => {
            setDeleteTarget(row);
            setDeleteError("");
          },
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar destinatários..."
        onNew={() => setModalMode("create")}
        onSearch={handleSearch}
        showNew={perms.canCreate}
      />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />

      <Modal open={modalMode === "create"} onClose={closeModal} width="520px">
        <DestinatarioForm mode="create" onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="520px">
        {formData && (
          <DestinatarioForm
            mode="edit"
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={handleSuccess}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="520px">
        {formData && (
          <DestinatarioForm mode="view" initialData={formData} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={handleDelete}
        title="Excluir destinatário"
        message={
          deleteError
            ? deleteError
            : `Tem certeza que deseja excluir "${deleteTarget?.razao}"?`
        }
        confirmLabel={deleteError ? "OK" : "Excluir"}
        loading={deleting}
      />
    </>
  );
}