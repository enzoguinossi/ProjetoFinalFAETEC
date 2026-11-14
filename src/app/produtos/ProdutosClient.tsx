"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import ProdutoForm from "./novo/ProdutoForm";
import ProdutoView from "./novo/ProdutoView";
import DesmembrarProdutoModal from "./novo/DesmembrarProdutoModal";
import type { Action, Column } from "@/components/DataTable";
import type { PaginatedResult, PermissoesEntidade, TipoProdutoItem } from "@/types";
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
  conversoes: { id_conversao: number; nome: string; fator: number; descricao: string | null; padrao: boolean }[];
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  tiposProduto: TipoProdutoItem[];
  perms: PermissoesEntidade;
  permsTipo: PermissoesEntidade;
  /** `produto.ver_inativos`: habilita o filtro de situação e a coluna Situação. */
  podeVerInativos: boolean;
  /** `estoque.entrada` + `estoque.saida`: habilita a ação Desmembrar. */
  podeDesmembrar: boolean;
}

const columnsBase: Column<ProdutoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr", align: "center", sortable: true, fixed: true },
  {
    key: "descricao",
    label: "Descrição",
    width: "2fr",
    align: "left",
    sortable: true,
  },
  { key: "tipo", label: "Tipo", width: "1.5fr", align: "left", sortable: true },
  { key: "qtd", label: "Quantidade", width: "1fr", align: "right", sortable: true },
  { key: "livre", label: "Qtd. Livre", width: "1fr", align: "right" },
];

const colunaSituacao: Column<ProdutoListRow> = {
  key: "ativo",
  label: "Situação",
  width: "1fr",
  align: "center",
  sortable: true,
  sortKey: "ativo",
  render: (_valor, row) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4 ${
        row.ativo
          ? "bg-[rgba(27,153,86,0.12)] text-[#15844a]"
          : "bg-[#eef1f4] text-[#697077]"
      }`}
    >
      {row.ativo ? "Ativo" : "Inativo"}
    </span>
  ),
};

export default function ProdutosClient({
  inicial,
  conversoes,
  tiposCodigo,
  tiposProduto,
  perms,
  permsTipo,
  podeVerInativos,
  podeDesmembrar,
}: Props) {
  const router = useRouter();
  const {
    resultado,
    carregando,
    buscarPorTermo,
    aplicarFiltros,
    ordenacao,
    ordenar,
    paginacaoServidor,
    actions: acoesCrud,
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

  const [chaveFiltros, setChaveFiltros] = useState(0);
  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [tipos, setTipos] = useState<TipoProdutoItem[]>(tiposProduto);
  const [desmembrarId, setDesmembrarId] = useState<number | null>(null);

  const actions: Action<ProdutoListRow>[] = [
    ...acoesCrud,
    {
      icon: "/icons/actions/Desmembrar.svg",
      label: "Desmembrar",
      visible: (row) => podeDesmembrar && row.composto && row.ativo,
      onClick: (row) => setDesmembrarId(row.id_produto),
    },
  ];

  const camposFiltro: CampoFiltro[] = [
    ...(podeVerInativos
      ? [
          {
            id: "situacao",
            rotulo: "Situação",
            tipo: "multi" as const,
            opcoes: [
              { valor: "ativo", rotulo: "Ativos" },
              { valor: "inativo", rotulo: "Inativos" },
            ],
          },
        ]
      : []),
    { id: "perecivel", rotulo: "Perecível", tipo: "checkbox" },
    { id: "composto", rotulo: "Composto", tipo: "checkbox" },
    {
      id: "tipo_codigo",
      rotulo: "Tipo de código",
      tipo: "multi",
      opcoes: tiposCodigo.map((tipo) => ({
        valor: String(tipo.id_tipo_codigo),
        rotulo: tipo.nome,
      })),
    },
    {
      id: "tipo_produto",
      rotulo: "Tipo de produto",
      tipo: "multi",
      opcoes: tipos.map((tipo) => ({
        valor: String(tipo.id_tipo_produto),
        rotulo: tipo.nome,
      })),
    },
  ];

  const columns = podeVerInativos ? [...columnsBase, colunaSituacao] : columnsBase;

  function montarFiltros(novos: Valores) {
    const situacao = novos.situacao;
    let ativo: boolean | null | undefined;
    if (Array.isArray(situacao) && situacao.length > 0) {
      const soAtivos = situacao.includes("ativo") && !situacao.includes("inativo");
      const soInativos = situacao.includes("inativo") && !situacao.includes("ativo");
      ativo = soAtivos ? true : soInativos ? false : null;
    }

    const marcado = (campo: string) => {
      const valor = novos[campo];
      return Array.isArray(valor) && valor.includes("1") ? true : undefined;
    };

    const tipos = novos.tipo_codigo;
    const idTipoCodigo =
      Array.isArray(tipos) && tipos.length > 0
        ? tipos.map((id) => Number(id)).filter((id) => Number.isInteger(id))
        : undefined;

    const tiposProduto = novos.tipo_produto;
    const idTipoProduto =
      Array.isArray(tiposProduto) && tiposProduto.length > 0
        ? tiposProduto
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id))
        : undefined;

    return {
      incluirInativos: podeVerInativos,
      ativo,
      perecivel: marcado("perecivel"),
      composto: marcado("composto"),
      id_tipo_codigo: idTipoCodigo,
      id_tipo_produto: idTipoProduto,
    };
  }

  function aplicarFiltrosTela(novos: Valores) {
    setValoresFiltros(novos);
    aplicarFiltros(montarFiltros(novos));
  }

  function aoMudarTipos(lista: TipoProdutoItem[]) {
    setTipos(lista);

    // Um tipo selecionado no filtro pode ter sido excluído no cadastro: remove
    // os ids inválidos e reaplica o recorte para a lista não ficar vazia à toa.
    const selecionados = valoresFiltros.tipo_produto;
    if (Array.isArray(selecionados)) {
      const validos = new Set(lista.map((tipo) => String(tipo.id_tipo_produto)));
      const restantes = selecionados.filter((id) => validos.has(String(id)));
      if (restantes.length !== selecionados.length) {
        const novos = { ...valoresFiltros, tipo_produto: restantes };
        setValoresFiltros(novos);
        aplicarFiltros(montarFiltros(novos));
      }
    }

    setChaveFiltros((chave) => chave + 1);
    router.refresh();
  }

  function limparFiltrosTela() {
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    aplicarFiltros({ incluirInativos: podeVerInativos });
  }

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
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
        idTabela="produtos"
        actions={actions}
        paginacaoServidor={paginacaoServidor}
        carregando={carregando}
        ordenacao={ordenacao}
        onOrdenar={ordenar}
      />

      <Modal open={modalMode === "create"} onClose={fecharModal} width="960px">
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          tiposProduto={tipos}
          permsTipo={permsTipo}
          onTiposProdutoChange={aoMudarTipos}
          onSuccess={aoSalvar}
          onCancel={fecharModal}
        />
      </Modal>

      <Modal open={modalMode === "edit" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <ProdutoForm
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            tiposProduto={tipos}
            permsTipo={permsTipo}
            onTiposProdutoChange={aoMudarTipos}
            initialData={formData}
            canDeactivate={perms.canDeactivate}
            onSuccess={aoSalvar}
            onCancel={fecharModal}
          />
        )}
      </Modal>

      <Modal open={modalMode === "view" && formData !== null} onClose={fecharModal} width="960px">
        {formData && (
          <ProdutoView
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            data={formData}
            onClose={fecharModal}
            podeDesmembrar={podeDesmembrar}
            onChanged={() => router.refresh()}
          />
        )}
      </Modal>

      {desmembrarId !== null && (
        <DesmembrarProdutoModal
          idProduto={desmembrarId}
          onClose={() => setDesmembrarId(null)}
          onSuccess={() => router.refresh()}
        />
      )}

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
