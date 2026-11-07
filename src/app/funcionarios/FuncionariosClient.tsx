"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import FuncionarioForm from "./novo/FuncionarioForm";
import type { Column } from "@/components/DataTable";
import { useState } from "react";
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
  /** Cargos distintos já cadastrados (opções do filtro de cargo). */
  cargos: string[];
  perms: PermissoesEntidade;
}

const columns: Column<FuncionarioListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "nome", label: "Nome", width: "3fr", align: "left" },
  { key: "cargo", label: "Cargo", width: "2fr", align: "left" },
  { key: "condutor", label: "Condutor", width: "1fr", align: "center" },
];

export default function FuncionariosClient({ inicial, tiposCodigo, cargos, perms }: Props) {
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
  } = useCrudLista<FuncionarioListRow, FuncionarioFormData>({
    buscar: listarFuncionarios,
    inicial,
    carregar: getFuncionario,
    excluir: deleteFuncionario,
    idDe: (row) => row.id_funcionario,
    perms,
    mensagemExcluido: "Funcionário excluído com sucesso.",
  });

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    {
      id: "cargo",
      rotulo: "Cargo",
      tipo: "multi",
      opcoes: cargos.map((cargo) => ({ valor: cargo, rotulo: cargo })),
    },
    { id: "condutor", rotulo: "Condutor", tipo: "checkbox" },
  ];

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    const cargo = novos.cargo;
    const condutor = novos.condutor;
    aplicarFiltros({
      cargos: Array.isArray(cargo) && cargo.length > 0 ? cargo : undefined,
      condutor: Array.isArray(condutor) && condutor.includes("1") ? true : undefined,
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
        placeholder="Pesquisar funcionários..."
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
