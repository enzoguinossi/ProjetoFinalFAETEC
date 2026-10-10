"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import FornecedorForm from "./novo/FornecedorForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarFornecedores,
  getFornecedor,
  deleteFornecedor,
  type FornecedorListRow,
  type FornecedorFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<FornecedorListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<FornecedorListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "razao", label: "Razão Social", width: "5fr" },
];

export default function FornecedoresClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<FornecedorListRow, FornecedorFormData>({
    buscar: listarFornecedores,
    inicial,
    carregar: getFornecedor,
    excluir: deleteFornecedor,
    idDe: (row) => row.id_fornecedor,
    perms,
    mensagemExcluido: "Fornecedor excluído com sucesso.",
  });

  return (
    <>
      <SearchBar
        placeholder="Pesquisar fornecedores..."
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
        <FornecedorForm mode="create" tiposCodigo={tiposCodigo} onSuccess={aoSalvar} onCancel={fecharModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <FornecedorForm
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
          <FornecedorForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={fecharModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir "${deleteTarget?.razao}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
