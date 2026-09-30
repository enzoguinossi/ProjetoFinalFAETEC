"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import VeiculoForm from "./novo/VeiculoForm";
import type { Column } from "@/components/DataTable";
import { searchVeiculosList, type VeiculoListRow } from "./actions";
import { getVeiculo, deleteVeiculo } from "./novo/actions";
import type { VeiculoFormData } from "./novo/actions";

interface Props { rows: VeiculoListRow[]; }

const columns: Column<VeiculoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "placa", label: "Placa", width: "1.5fr" },
  { key: "status", label: "Status", width: "1fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function VeiculosClient({ rows: initialRows }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<VeiculoFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VeiculoListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const searchRef = useRef("");

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
  function handleSuccess() { closeModal(); window.location.reload(); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError("");
    try {
      const result = await deleteVeiculo(deleteTarget.id_veiculo);
      if (result.error) setDeleteError(result.error); else { setDeleteTarget(null); window.location.reload(); }
    } catch { setDeleteError("Erro ao excluir."); } finally { setDeleting(false); }
  }

  const actions = [
    { icon: "/icons/actions/Olho.svg", label: "Visualizar", onClick: (row: VeiculoListRow) => openModal(row.id_veiculo, "view") },
    { icon: "/icons/actions/Editar.svg", label: "Editar", onClick: (row: VeiculoListRow) => openModal(row.id_veiculo, "edit") },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row: VeiculoListRow) => { setDeleteTarget(row); setDeleteError(""); } },
  ];

  return (
    <>
      <SearchBar placeholder="Pesquisar veículos..." onNew={() => setModalMode("create")} onSearch={handleSearch} />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />
      <Modal open={modalMode === "create"} onClose={closeModal} width="520px"><VeiculoForm mode="create" onSuccess={handleSuccess} onCancel={closeModal} /></Modal>
      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="520px">{formData && <VeiculoForm mode="edit" initialData={formData} onSuccess={handleSuccess} onCancel={closeModal} />}</Modal>
      <Modal open={modalMode === "view" && formData !== null} onClose={closeModal} width="520px">{formData && <VeiculoForm mode="view" initialData={formData} onCancel={closeModal} />}</Modal>
      <ConfirmDialog open={deleteTarget !== null} onClose={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={handleDelete} title="Excluir veículo" message={deleteError || `Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`} confirmLabel={deleteError ? "OK" : "Excluir"} loading={deleting} />
    </>
  );
}