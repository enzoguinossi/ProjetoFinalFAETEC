"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import UsuarioForm from "./novo/UsuarioForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchUsuariosList, type UsuarioListRow } from "./actions";
import { getUsuario, deleteUsuario } from "./novo/actions";
import type { UsuarioFormData } from "./novo/actions";

interface Props {
  rows: UsuarioListRow[];
  funcionarios: { id_funcionario: number; pessoaFisica: { nome: string } }[];
  grupos: { prefixo: string; permissoes: { id_permissao: number; nome: string; descricao: string | null }[] }[];
  perfis: { id_perfil: number; nome: string; descricao: string | null }[];
  perfilPermissoes: Record<number, string[]>;
  perms: PermissoesEntidade;
}

const columns: Column<UsuarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "nome", label: "Nome", width: "3fr" },
  { key: "login", label: "Login", width: "2fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function UsuariosClient({ rows: initialRows, funcionarios, grupos, perfis, perfilPermissoes, perms }: Props) {
  const router = useRouter();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<UsuarioFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UsuarioListRow | null>(null);
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
    searchUsuariosList(value).then(setRows).catch(() => setRows(initialRows));
  }

  async function openEdit(id: number) {
    const data = await getUsuario(id);
    setFormData(data);
    setModalMode("edit");
  }

  async function openView(id: number) {
    const data = await getUsuario(id);
    setFormData(data);
    setModalMode("view");
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
      const result = await deleteUsuario(deleteTarget.id_usuario);
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

  const actions: Action<UsuarioListRow>[] = [
    ...(perms.canView
      ? [{
          icon: "/icons/actions/Olho.svg",
          label: "Visualizar",
          onClick: (row: UsuarioListRow) => openView(row.id_usuario),
        }]
      : []),
    ...(perms.canEdit
      ? [{
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: UsuarioListRow) => openEdit(row.id_usuario),
        }]
      : []),
    ...(perms.canDelete
      ? [{
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: UsuarioListRow) => {
            setDeleteTarget(row);
            setDeleteError("");
          },
        }]
      : []),
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Pesquisar usuários..."
            onNew={() => setModalMode("create")}
            onSearch={handleSearch}
            showNew={perms.canCreate}
          />
        </div>
        <Button label="Gerenciar perfis" onClick={() => router.push("/perfis")} />
      </div>
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />

      <Modal open={modalMode === "create"} onClose={closeModal} width="1000px">
        <UsuarioForm
          funcionarios={funcionarios}
          grupos={grupos}
          perfis={perfis}
          perfilPermissoes={perfilPermissoes}
          mode="create"
          onSuccess={handleSuccess}
          onCancel={closeModal}
        />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="1000px">
        {formData && (
          <UsuarioForm
            funcionarios={funcionarios}
            grupos={grupos}
            perfis={perfis}
            perfilPermissoes={perfilPermissoes}
            mode="edit"
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={handleSuccess}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="1000px">
        {formData && (
          <UsuarioForm
            funcionarios={funcionarios}
            grupos={grupos}
            perfis={perfis}
            perfilPermissoes={perfilPermissoes}
            mode="view"
            initialData={formData}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={handleDelete}
        title="Excluir usuário"
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