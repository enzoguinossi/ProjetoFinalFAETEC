"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import VeiculoForm from "./novo/VeiculoForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchVeiculosList, type VeiculoListRow } from "./actions";
import { getVeiculo, deleteVeiculo } from "./novo/actions";
import type { VeiculoFormData } from "./novo/actions";

interface Props { rows: VeiculoListRow[]; tiposCodigo: { id_tipo_codigo: number; nome: string }[]; perms: PermissoesEntidade; }

const columns: Column<VeiculoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "placa", label: "Placa", width: "1.5fr" },
  { key: "status", label: "Status", width: "1fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function VeiculosClient({ rows: initialRows, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<VeiculoFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VeiculoListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef("");
  const router = useRouter();
  const mostrarAviso = useAviso();

  useEffect(() => { if (searchRef.current.length < 2) setRows(initialRows); }, [initialRows]);

  function handleSearch(value: string) {
    searchRef.current = value;
    if (value.length < 2) { setRows(initialRows); return; }
    searchVeiculosList(value).then(setRows).catch(() => setRows(initialRows));
  }

  async function openModal(id: number | null, mode: "edit" | "view") {
    if (id === null) { setModalMode("create"); return; }
    const data = await getVeiculo(id); setFormData(data); setModalMode(mode);
  }

  function closeModal() { setModalMode(null); setFormData(null); }
  function handleSuccess() { closeModal(); router.refresh(); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteVeiculo(deleteTarget.id_veiculo);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Veículo excluído com sucesso.", "sucesso");
      setDeleteTarget(null); router.refresh();
    } catch { mostrarAviso("Erro ao excluir.", "erro"); } finally { setDeleting(false); }
  }

  const actions: Action<VeiculoListRow>[] = [
    ...(perms.canView ? [{ icon: "/icons/actions/Olho.svg", label: "Visualizar", onClick: (row: VeiculoListRow) => openModal(row.id_veiculo, "view") }] : []),
    ...(perms.canEdit ? [{ icon: "/icons/actions/Editar.svg", label: "Editar", onClick: (row: VeiculoListRow) => openModal(row.id_veiculo, "edit") }] : []),
    ...(perms.canDelete ? [{ icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row: VeiculoListRow) => setDeleteTarget(row) }] : []),
  ];

  return (
    <>
      <SearchBar placeholder="Pesquisar veículos..." onNew={() => setModalMode("create")} onSearch={handleSearch} showNew={perms.canCreate} />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />
      <Modal open={modalMode === "create"} onClose={closeModal} width="520px"><VeiculoForm mode="create" tiposCodigo={tiposCodigo} onSuccess={handleSuccess} onCancel={closeModal} /></Modal>
      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="520px">{formData && <VeiculoForm mode="edit" initialData={formData} tiposCodigo={tiposCodigo} canDeactivate={perms.canDeactivate} onSuccess={handleSuccess} onCancel={closeModal} />}</Modal>
      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="520px">{formData && <VeiculoForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={closeModal} />}</Modal>
      <ConfirmDialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Excluir veículo" message={`Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`} confirmLabel="Excluir" loading={deleting} />
    </>
  );
}