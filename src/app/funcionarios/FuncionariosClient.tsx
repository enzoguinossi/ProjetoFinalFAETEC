"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import FuncionarioForm from "./novo/FuncionarioForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchFuncionariosList, type FuncionarioListRow } from "./actions";
import { getFuncionario, deleteFuncionario } from "./novo/actions";
import type { FuncionarioFormData } from "./novo/actions";

interface Props {
  rows: FuncionarioListRow[];
  perms: PermissoesEntidade;
}

const columns: Column<FuncionarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "nome", label: "Nome", width: "3fr" },
  { key: "cargo", label: "Cargo", width: "2fr" },
  { key: "condutor", label: "Condutor", width: "1fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function FuncionariosClient({ rows: initialRows, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<FuncionarioFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuncionarioListRow | null>(null);
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
    searchFuncionariosList(value).then(setRows).catch(() => setRows(initialRows));
  }

  async function openModal(id: number | null, mode: "edit" | "view") {
    if (id === null) { setModalMode("create"); return; }
    const data = await getFuncionario(id);
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
      const result = await deleteFuncionario(deleteTarget.id_funcionario);
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

  const actions: Action<FuncionarioListRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: FuncionarioListRow) => openModal(row.id_funcionario, "view"),
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: FuncionarioListRow) => openModal(row.id_funcionario, "edit"),
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: FuncionarioListRow) => {
            setDeleteTarget(row);
            setDeleteError("");
          },
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar funcionários..."
        onNew={() => setModalMode("create")}
        onSearch={handleSearch}
        showNew={perms.canCreate}
      />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />

      <Modal open={modalMode === "create"} onClose={closeModal} width="520px">
        <FuncionarioForm mode="create" onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="520px">
        {formData && (
          <FuncionarioForm
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
          <FuncionarioForm mode="view" initialData={formData} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={handleDelete}
        title="Excluir funcionário"
        message={
          deleteError
            ? deleteError
            : `Tem certeza que deseja excluir "${deleteTarget?.nome}"?`
        }
        confirmLabel={deleteError ? "OK" : "Excluir"}
        loading={deleting}
      />
    </>
  );
}