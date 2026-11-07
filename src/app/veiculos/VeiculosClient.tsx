"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import VeiculoForm from "./novo/VeiculoForm";
import type { Column } from "@/components/DataTable";
import { useState } from "react";
import { STATUS_VEICULO, type PaginatedResult, type PermissoesEntidade } from "@/types";
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
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "descricao", label: "Descrição", width: "2fr", align: "left" },
  { key: "placa", label: "Placa", width: "1.5fr", align: "center" },
  { key: "status", label: "Status", width: "1fr", align: "center" },
];

const ROTULOS_STATUS_FILTRO: Record<(typeof STATUS_VEICULO)[number], string> = {
  DISPONIVEL: "Disponível",
  INDISPONIVEL: "Indisponível",
  EM_EXPEDICAO: "Em expedição",
};

export default function VeiculosClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<VeiculoListRow, VeiculoFormData>({
    buscar: listarVeiculos,
    inicial,
    carregar: getVeiculo,
    excluir: deleteVeiculo,
    idDe: (row) => row.id_veiculo,
    perms,
    mensagemExcluido: "Veículo excluído com sucesso.",
  });

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    {
      id: "status",
      rotulo: "Status",
      tipo: "multi",
      opcoes: STATUS_VEICULO.map((status) => ({
        valor: status,
        rotulo: ROTULOS_STATUS_FILTRO[status],
      })),
    },
  ];

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    const status = novos.status;
    aplicarFiltros({
      status: Array.isArray(status) && status.length > 0 ? status : undefined,
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
        placeholder="Pesquisar veículos..."
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
