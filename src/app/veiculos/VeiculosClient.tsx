"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import VeiculoForm from "./novo/VeiculoForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarVeiculos,
  getVeiculo,
  deleteVeiculo,
  type VeiculoListRow,
  type VeiculoFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<VeiculoListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<VeiculoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "placa", label: "Placa", width: "1.5fr" },
  { key: "status", label: "Status", width: "1fr" },
];

export default function VeiculosClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<VeiculoListRow, VeiculoFormData>({
    buscar: listarVeiculos,
    inicial,
    carregar: getVeiculo,
    excluir: deleteVeiculo,
    idDe: (row) => row.id_veiculo,
    perms,
    mensagemExcluido: "Veículo excluído com sucesso.",
  });

  return (
    <>
      <SearchBar
        placeholder="Pesquisar veículos..."
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

      <Modal open={modalMode === "create"} onClose={fecharModal} width="520px">
        <VeiculoForm mode="create" tiposCodigo={tiposCodigo} onSuccess={aoSalvar} onCancel={fecharModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="520px">
        {formData && (
          <VeiculoForm
            mode="edit"
            initialData={formData}
            tiposCodigo={tiposCodigo}
            canDeactivate={perms.canDeactivate}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="520px">
        {formData && (
          <VeiculoForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={fecharModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir veículo"
        message={`Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
