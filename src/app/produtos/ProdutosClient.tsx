"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProdutoForm from "./novo/ProdutoForm";
import ProdutoView from "./novo/ProdutoView";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { useCrudLista } from "@/lib/use-crud-lista";
import {
  listarProdutos,
  getProduto,
  deleteProduto,
  type ProdutoListRow,
  type ProdutoFormData,
} from "./actions";

interface Props {
  inicial: PaginatedResult<ProdutoListRow>;
  conversoes: { id_conversao: number; nome: string; fator: number; descricao: string | null }[];
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  perms: PermissoesEntidade;
}

const columns: Column<ProdutoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "qtd", label: "Quantidade", width: "1fr" },
  { key: "livre", label: "Qtd. Livre", width: "1fr" },
];

export default function ProdutosClient({ inicial, conversoes, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<ProdutoListRow, ProdutoFormData>({
    buscar: listarProdutos,
    inicial,
    carregar: getProduto,
    excluir: deleteProduto,
    idDe: (row) => row.id_produto,
    perms,
    mensagemExcluido: "Produto excluído com sucesso.",
  });

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
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

      <Modal open={modalMode === "create"} onClose={fecharModal} width="728px">
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          onSuccess={aoSalvar}
          onCancel={fecharModal}
        />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="728px">
        {formData && (
          <ProdutoForm
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="728px">
        {formData && (
          <ProdutoView
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            data={formData}
            onClose={fecharModal}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir "${deleteTarget?.descricao}"?`}
        confirmLabel="Excluir"
        loading={excluindo}
      />
    </>
  );
}
