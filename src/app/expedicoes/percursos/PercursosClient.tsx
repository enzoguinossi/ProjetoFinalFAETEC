"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import PercursoForm from "./novo/PercursoForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarPercursos,
  getPercurso,
  excluirPercurso,
  type PercursoListRow,
  type PercursoFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<PercursoListRow>;
  perms: PermissoesEntidade;
}

const columns: Column<PercursoListRow>[] = [
  { key: "nome", label: "Nome", width: "4fr", align: "left" },
  {
    key: "total_destinatarios",
    label: "Destinatários",
    width: "1.2fr",
    align: "right",
    render: (value) => String(value ?? 0),
  },
];

export default function PercursosClient({ inicial, perms }: Props) {
  const {
    resultado,
    carregando,
    buscarPorTermo,
    paginacaoServidor,
    actions,
    modalMode,
    formData,
    abrirNovo,
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
    excluir: excluirPercurso,
    idDe: (row) => row.id_percurso,
    perms,
    mensagemExcluido: "Percurso excluído com sucesso.",
  });

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
        title="Excluir percurso"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Esta ação é permanente: o percurso e a ordem das visitas serão apagados.`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
