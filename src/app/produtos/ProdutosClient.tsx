"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProdutoForm from "./novo/ProdutoForm";
import type { Column, Action } from "@/components/DataTable";
import type { PermissoesEntidade } from "@/types";
import { searchProdutosList, type ProdutoListRow } from "./actions";
import { getProduto, deleteProduto } from "./novo/actions";
import type { ProdutoFormData } from "./novo/actions";

interface Props {
  rows: ProdutoListRow[];
  conversoes: { id_conversao: number; nome: string }[];
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

export default function ProdutosClient({ rows: initialRows, conversoes, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [rows, setRows] = useState(initialRows);
  const [formData, setFormData] = useState<ProdutoFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdutoListRow | null>(null);
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
    searchProdutosList(value).then(setRows).catch(() => setRows(initialRows));
  }

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
    window.location.reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteProduto(deleteTarget.id_produto);
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
          onClick: (row: ProdutoListRow) => {
            setDeleteTarget(row);
            setDeleteError("");
          },
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
        onNew={() => setModalMode("create")}
        onSearch={handleSearch}
        showNew={perms.canCreate}
      />
      <DataTable columns={columns} data={rows} idField="codigo" actions={actions} />

      <Modal
        open={modalMode === "create"}
        onClose={closeModal}
        width="728px"
      >
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          mode="create"
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
            mode="edit"
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
          <ProdutoForm
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
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
        title="Excluir produto"
        message={
          deleteError
            ? deleteError
            : `Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`
        }
        confirmLabel={deleteError ? "OK" : "Excluir"}
        loading={deleting}
      />
    </>
  );
}