"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import FornecedorForm from "./novo/FornecedorForm";
import SituacaoBadge from "@/components/SituacaoBadge";
import type { Column } from "@/components/DataTable";
import { useState } from "react";
import type { PaginatedResult, PermissoesEntidade } from "@/types";
import { UFS } from "@/lib/uf";
import { OPCOES_SITUACAO, situacaoParaAtivo } from "@/lib/filtros-situacao";
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
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "razao", label: "Razão Social", width: "5fr", align: "left" },
  {
    key: "ativo",
    label: "Situação",
    width: "1fr",
    align: "center",
    render: (_value, row) => <SituacaoBadge ativo={row.ativo} />,
  },
];

export default function FornecedoresClient({ inicial, tiposCodigo, perms }: Props) {
  const {
    resultado,
    carregando,
    buscarPorTermo,
    aplicarFiltros,
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

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    {
      id: "situacao",
      rotulo: "Situação",
      tipo: "multi",
      opcoes: [...OPCOES_SITUACAO],
    },
    {
      id: "uf",
      rotulo: "UF",
      tipo: "multi",
      opcoes: UFS.map((uf) => ({ valor: uf, rotulo: uf })),
    },
  ];

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    const uf = novos.uf;
    aplicarFiltros({
      ativo: situacaoParaAtivo(novos.situacao),
      ufs: Array.isArray(uf) && uf.length > 0 ? uf : undefined,
    });
  }

  function limparFiltrosTela() {
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    aplicarFiltros({});
  }

  return (
    <>
      <SearchBar
        placeholder="Pesquisar fornecedores..."
        onNew={abrirNovo}
        onSearch={buscarPorTermo}
        showNew={perms.canCreate}
      />
      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltrosTela}
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
