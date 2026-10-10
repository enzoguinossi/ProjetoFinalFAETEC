"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import FuncionarioForm from "./novo/FuncionarioForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
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

export default function FuncionariosClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<FuncionarioListRow, FuncionarioFormData>({
    buscar: listarFuncionarios,
    inicial,
    carregar: getFuncionario,
    excluir: deleteFuncionario,
    idDe: (row) => row.id_funcionario,
    perms,
    mensagemExcluido: "Funcionário excluído com sucesso.",
  });

  return (
    <>
      <SearchBar
        placeholder="Pesquisar funcionários..."
        onNew={abrirNovo}
        onSearch={buscarPorTermo}
        showNew={perms.canCreate}
      />
      <DataTable
        columns={columns}
        data={resultado.data}
        idField="codigo"
        actions={actions}
        paginacaoServidor={paginacaoServidor}
        carregando={carregando}
      />

      <Modal open={modalMode === "create"} onClose={fecharModal} width="960px">
        <FuncionarioForm mode="create" tiposCodigo={tiposCodigo} onSuccess={aoSalvar} onCancel={fecharModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <FuncionarioForm
            mode="edit"
            initialData={formData}
            tiposCodigo={tiposCodigo}
            canDeactivate={perms.canDeactivate}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <FuncionarioForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={fecharModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir funcionário"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
