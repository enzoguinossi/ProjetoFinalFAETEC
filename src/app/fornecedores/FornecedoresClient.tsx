"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import FornecedorForm from "./novo/FornecedorForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchFornecedoresList, type FornecedorListRow } from "./actions";
import { getFornecedor, deleteFornecedor } from "./novo/actions";
import type { FornecedorFormData } from "./novo/actions";

interface Props {
  rows: FornecedorListRow[];
  perms: PermissoesEntidade;
}

const columns: Column<FornecedorListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "razao", label: "Razão Social", width: "5fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function FornecedoresClient({ rows: initialRows, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<FornecedorFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FornecedorListRow | null>(null);
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
    searchFornecedoresList(value).then(setRows).catch(() => setRows(initialRows));
  }

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
    window.location.reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteFornecedor(deleteTarget.id_fornecedor);
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
          onClick: (row: FornecedorListRow) => {
            setDeleteTarget(row);
            setDeleteError("");
          },
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar fornecedores..."
        onNew={() => setModalMode("create")}
        onSearch={handleSearch}
        showNew={perms.canCreate}
      />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />

      <Modal open={modalMode === "create"} onClose={closeModal} width="520px">
        <FornecedorForm mode="create" onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="520px">
        {formData && (
          <FornecedorForm
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
          <FornecedorForm mode="view" initialData={formData} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={handleDelete}
        title="Excluir fornecedor"
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