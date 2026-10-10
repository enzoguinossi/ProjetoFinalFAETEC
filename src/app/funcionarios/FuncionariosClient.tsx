"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAviso } from "@/components/AvisoProvider";
import FuncionarioForm from "./novo/FuncionarioForm";
import type { Column, Action } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useListaPaginada } from "@/lib/use-lista-paginada";
import {
  listarFuncionarios,
  getFuncionario,
  deleteFuncionario,
  type FuncionarioListRow,
  type FuncionarioFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<FuncionarioListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<FuncionarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "nome", label: "Nome", width: "3fr" },
  { key: "cargo", label: "Cargo", width: "2fr" },
  { key: "condutor", label: "Condutor", width: "1fr" },
];

type ModalMode = "create" | "edit" | "view" | null;

export default function FuncionariosClient({ inicial, tiposCodigo, perms }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<FuncionarioFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuncionarioListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const mostrarAviso = useAviso();
  const { resultado, carregando, buscarPorTermo, irParaPagina, mudarTamanho } =
    useListaPaginada(listarFuncionarios, inicial);

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
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteFuncionario(deleteTarget.id_funcionario);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Funcionário excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      mostrarAviso("Erro ao excluir. Tente novamente.", "erro");
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
          onClick: (row: FuncionarioListRow) => setDeleteTarget(row),
        }]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar funcionários..."
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
        <FuncionarioForm mode="create" tiposCodigo={tiposCodigo} onSuccess={handleSuccess} onCancel={closeModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={closeModal} width="960px">
        {formData && (
          <FuncionarioForm
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
          <FuncionarioForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={closeModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir funcionário"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"?`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}