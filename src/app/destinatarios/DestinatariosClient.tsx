"use client";

import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import DestinatarioForm from "./novo/DestinatarioForm";
import type { Column } from "@/components/DataTable";
import { useState } from "react";
import {
  ROTULOS_TIPO_DESTINATARIO,
  TIPO_DESTINATARIO,
  type PaginatedResult,
  type PermissoesEntidade,
  type TipoDestinatario,
} from "@/types";
import { UFS } from "@/lib/uf";
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
  { key: "razao", label: "Razão Social", width: "4fr", align: "left" },
  {
    key: "tipo_destinatario",
    label: "Tipo",
    width: "1fr",
    align: "center",
    render: (value) =>
      ROTULOS_TIPO_DESTINATARIO[value as TipoDestinatario] ?? String(value),
  },
];

export default function DestinatariosClient({ inicial, tiposCodigo, perms }: Props) {
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
  } = useCrudLista<DestinatarioListRow, DestinatarioFormData>({
    buscar: listarDestinatarios,
    inicial,
    carregar: getDestinatario,
    excluir: deleteDestinatario,
    idDe: (row) => row.id_destinatario,
    perms,
    mensagemExcluido: "Destinatário excluído com sucesso.",
  });

  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);

  const camposFiltro: CampoFiltro[] = [
    {
      id: "tipo",
      rotulo: "Tipo",
      tipo: "multi",
      opcoes: TIPO_DESTINATARIO.map((tipo) => ({
        valor: tipo,
        rotulo: ROTULOS_TIPO_DESTINATARIO[tipo],
      })),
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
    const tipo = novos.tipo;
    const uf = novos.uf;
    aplicarFiltros({
      tipos: Array.isArray(tipo) && tipo.length > 0 ? tipo : undefined,
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
        placeholder="Pesquisar destinatários..."
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
