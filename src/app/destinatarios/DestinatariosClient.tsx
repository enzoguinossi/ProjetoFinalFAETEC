"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import DestinatarioForm from "./novo/DestinatarioForm";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarDestinatarios,
  getDestinatario,
  deleteDestinatario,
  type DestinatarioListRow,
  type DestinatarioFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<DestinatarioListRow>;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<DestinatarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "razao", label: "Razão Social", width: "5fr", align: "left" },
];

export default function DestinatariosClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<DestinatarioListRow, DestinatarioFormData>({
    buscar: listarDestinatarios,
    inicial,
    carregar: getDestinatario,
    excluir: deleteDestinatario,
    idDe: (row) => row.id_destinatario,
    perms,
    mensagemExcluido: "Destinatário excluído com sucesso.",
  });

  return (
    <>
      <SearchBar
        placeholder="Pesquisar destinatários..."
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
        <DestinatarioForm mode="create" tiposCodigo={tiposCodigo} onSuccess={aoSalvar} onCancel={fecharModal} />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <DestinatarioForm
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
          <DestinatarioForm mode="view" initialData={formData} tiposCodigo={tiposCodigo} onCancel={fecharModal} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir destinatário"
        message={`Tem certeza que deseja excluir "${deleteTarget?.razao}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
