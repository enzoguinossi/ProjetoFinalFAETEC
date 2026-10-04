"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import type { Column, Action } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import Button from "@/components/Button";
import PerfilForm from "./novo/PerfilForm";
import type { PerfilListRow, PerfilFormData } from "./actions";
import { getPerfil, excluirPerfil } from "./actions";
import type { GrupoPermissoes } from "@/components/PermissoesPanel";

interface Props {
  rows: PerfilListRow[];
  grupos: GrupoPermissoes[];
}

const columns: Column<PerfilListRow>[] = [
  { key: "nome", label: "Nome", width: "2fr" },
  { key: "descricao", label: "Descrição", width: "3fr" },
  {
    key: "permissoes", label: "Permissões", width: "1fr",
    render: (v) => String((v as string[])?.length ?? 0),
  },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function PerfisClient({ rows: initialRows, grupos }: Props) {
  const router = useRouter();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<PerfilFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerfilListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const mostrarAviso = useAviso();

  async function openModal(id: number, mode: "edit" | "view") {
    const data = await getPerfil(id);
    setFormData(data);
    setModalMode(mode);
  }

  function closeModal() { setModalMode(null); setFormData(null); }
  function handleSuccess() { closeModal(); router.refresh(); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await excluirPerfil(deleteTarget.id_perfil);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso("Perfil excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<PerfilListRow>[] = [
    { icon: "/icons/actions/Olho.svg", label: "Visualizar", onClick: (row) => openModal(row.id_perfil, "view") },
    { icon: "/icons/actions/Editar.svg", label: "Editar", onClick: (row) => openModal(row.id_perfil, "edit") },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row) => setDeleteTarget(row) },
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar placeholder="Pesquisar perfis..." onNew={() => setModalMode("create")} showNew />
        </div>
        <Button label="Voltar" variant="cancel" onClick={() => router.push("/usuarios")} />
      </div>

      <DataTable columns={columns} data={initialRows} idField="id_perfil" actions={actions} />

      <Modal open={modalMode === "create"} onClose={closeModal} width="1000px">
        <PerfilForm grupos={grupos} mode="create" onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="1000px">
        {formData && (
          <PerfilForm grupos={grupos} mode="edit" initialData={formData} onSuccess={handleSuccess} onCancel={closeModal} />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="1000px">
        {formData && (
          <PerfilForm grupos={grupos} mode="view" initialData={formData} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir perfil"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? As permissões já aplicadas aos usuários não serão removidas.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
