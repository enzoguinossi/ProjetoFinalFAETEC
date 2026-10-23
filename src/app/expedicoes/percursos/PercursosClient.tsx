"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import PercursoForm from "./novo/PercursoForm";
import type { Action, Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarPercursos,
  getPercurso,
  desativarPercurso,
  type PercursoListRow,
  type PercursoFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<PercursoListRow>;
  perms: PermissoesEntidade;
}

const columns: Column<PercursoListRow>[] = [
  { key: "nome", label: "Nome", width: "4fr" },
  {
    key: "total_destinatarios",
    label: "Destinatários",
    width: "1.2fr",
    align: "center",
    render: (value) => String(value ?? 0),
  },
  {
    key: "situacao",
    label: "Situação",
    width: "1.2fr",
    align: "center",
    render: (value) => {
      const ativo = value === "Ativo";
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-[2px] font-sans text-[0.8125rem] font-semibold ${
            ativo ? "bg-[rgba(27,153,86,0.1)] text-brand" : "bg-[#f2f4f8] text-[#697077]"
          }`}
        >
          {String(value)}
        </span>
      );
    },
  },
];

export default function PercursosClient({ inicial, perms }: Props) {
  const {
    resultado,
    carregando,
    buscarPorTermo,
    paginacaoServidor,
    modalMode,
    formData,
    abrirNovo,
    abrirModal,
    fecharModal,
    aoSalvar,
    deleteTarget,
    setDeleteTarget,
    confirmarExclusao,
    excluindo,
  } = useCrudLista<PercursoListRow, PercursoFormData>({
    buscar: listarPercursos,
    inicial,
    carregar: getPercurso,
    excluir: desativarPercurso,
    idDe: (row) => row.id_percurso,
    perms,
    mensagemExcluido: "Percurso desativado com sucesso.",
  });

  const actions: Action<PercursoListRow>[] = [
    ...(perms.canView
      ? [
          {
            icon: "/icons/actions/Olho.svg",
            label: "Visualizar",
            onClick: (row: PercursoListRow) => {
              void abrirModal(row, "view");
            },
          },
        ]
      : []),
    ...(perms.canEdit
      ? [
          {
            icon: "/icons/actions/Editar.svg",
            label: "Editar",
            onClick: (row: PercursoListRow) => {
              void abrirModal(row, "edit");
            },
          },
        ]
      : []),
    ...(perms.canDeactivate
      ? [
          {
            icon: "/icons/actions/Lixeira.svg",
            label: "Desativar",
            onClick: (row: PercursoListRow) => setDeleteTarget(row),
          },
        ]
      : []),
  ];

  return (
    <>
      <SearchBar
        placeholder="Pesquisar percursos..."
        onNew={abrirNovo}
        onSearch={buscarPorTermo}
        showNew={perms.canCreate}
      />
      <DataTable
        columns={columns}
        data={resultado.data}
        idField="id_percurso"
        actions={actions}
        paginacaoServidor={paginacaoServidor}
        carregando={carregando}
      />

      <Modal open={modalMode === "create"} onClose={fecharModal} width="900px">
        <PercursoForm mode="create" onSuccess={aoSalvar} onCancel={fecharModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="900px">
        {formData && (
          <PercursoForm
            mode="edit"
            initialData={formData}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="900px">
        {formData && (
          <PercursoForm
            mode="view"
            initialData={formData}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Desativar percurso"
        message={`Tem certeza que deseja desativar "${deleteTarget?.nome}"? Ele deixa de aparecer para novas rotas e o histórico é preservado.`}
        confirmLabel="Desativar"
        loading={excluindo}
      />
    </>
  );
}
