"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import { useAviso } from "@/components/AvisoProvider";
import type { Action, Column } from "@/components/DataTable";
import type { PaginatedResult } from "@/types";
import EntradaForm from "./EntradaForm";
import {
  listarNotasEntrada,
  obterNotaEntrada,
  type NotaEntradaFiltrosPayload,
} from "./actions";
import type {
  ConversaoUnidadeItem,
  FornecedorSelecaoRow,
  NotaEntradaFormData,
  NotaEntradaListRow,
} from "./tipos";

interface Props {
  inicial: PaginatedResult<NotaEntradaListRow>;
  conversoes: ConversaoUnidadeItem[];
  /** Opções do filtro de fornecedor. */
  fornecedores: FornecedorSelecaoRow[];
  podeCriar: boolean;
  /** `nota_entrada.consultar`: habilita a visualização da nota. */
  podeConsultar: boolean;
  /** `nota_entrada.alterar`: habilita a edição da nota. */
  podeAlterar: boolean;
  /** `fornecedor.criar`: habilita o "+" para cadastrar fornecedor na própria nota. */
  podeCriarFornecedor: boolean;
  /** Tipos de código aceitos pelo `FornecedorForm`. */
  tiposCodigoFornecedor: { id_tipo_codigo: number; nome: string }[];
}

type ModoModal = "create" | "edit" | "view" | null;

/** Números inteiros positivos, sem duplicatas; vazio vira `undefined`. */
function idsNumericos(
  valores: string[] | { de: string; ate: string } | undefined,
): number[] | undefined {
  if (!Array.isArray(valores)) return undefined;
  const ids = valores
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

const columnsEntrada: Column<NotaEntradaListRow>[] = [
  { key: "data", label: "Data", width: "1fr", align: "center" },
  { key: "fornecedor", label: "Fornecedor", width: "2fr", align: "left" },
  { key: "itens", label: "Itens", width: "0.7fr", align: "right" },
  {
    key: "chave_acesso",
    label: "Chave de acesso",
    width: "3fr",
    align: "left",
    render: (_valor, row) => (
      <span title={row.chave_acesso ?? undefined}>{row.chave_acesso ?? "—"}</span>
    ),
  },
];

const TITULOS: Record<Exclude<ModoModal, null>, string> = {
  create: "Nova entrada",
  edit: "Editar entrada",
  view: "Detalhes da entrada",
};

export default function EntradaClient({
  inicial,
  conversoes,
  fornecedores,
  podeCriar,
  podeConsultar,
  podeAlterar,
  podeCriarFornecedor,
  tiposCodigoFornecedor,
}: Props) {
  const mostrarAviso = useAviso();
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [modalMode, setModalMode] = useState<ModoModal>(null);
  const [formData, setFormData] = useState<NotaEntradaFormData | null>(null);
  const [carregandoNota, setCarregandoNota] = useState(false);
  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);
  const filtrosAtuais = useRef<NotaEntradaFiltrosPayload>({});

  const camposFiltro: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "fornecedor",
      rotulo: "Fornecedor",
      tipo: "multi",
      opcoes: fornecedores.map((fornecedor) => ({
        valor: String(fornecedor.id_fornecedor),
        rotulo: fornecedor.razao_social,
      })),
    },
  ];

  async function carregar(page = 1, limit = resultado.limit) {
    setCarregando(true);
    try {
      const atualizado = await listarNotasEntrada({
        page,
        limit,
        ...filtrosAtuais.current,
      });
      setResultado(atualizado);
    } finally {
      setCarregando(false);
    }
  }

  function aplicarFiltrosTela(novos: Valores) {
    const periodo = Array.isArray(novos.periodo) ? undefined : novos.periodo;
    filtrosAtuais.current = {
      de: periodo?.de || undefined,
      ate: periodo?.ate || undefined,
      id_fornecedor: idsNumericos(novos.fornecedor),
    };
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    void carregar(1);
  }

  function limparFiltrosTela() {
    filtrosAtuais.current = {};
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    void carregar(1);
  }

  function fecharModal() {
    setModalMode(null);
    setFormData(null);
  }

  async function abrirNota(row: NotaEntradaListRow, mode: "view" | "edit") {
    setCarregandoNota(true);
    try {
      const dados = await obterNotaEntrada(row.id_nota_entrada, mode);
      if (!dados) {
        mostrarAviso("Não foi possível carregar a nota de entrada.", "erro");
        return;
      }
      setFormData(dados);
      setModalMode(mode);
    } finally {
      setCarregandoNota(false);
    }
  }

  async function aoSalvar() {
    const pagina = modalMode === "create" ? 1 : resultado.page;
    fecharModal();
    await carregar(pagina);
  }

  const actions: Action<NotaEntradaListRow>[] = [
    ...(podeConsultar
      ? [
          {
            icon: "/icons/actions/Olho.svg",
            label: "Visualizar",
            onClick: (row: NotaEntradaListRow) => {
              void abrirNota(row, "view");
            },
          },
        ]
      : []),
    ...(podeAlterar
      ? [
          {
            icon: "/icons/actions/Editar.svg",
            label: "Editar",
            onClick: (row: NotaEntradaListRow) => {
              void abrirNota(row, "edit");
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-[590] text-ink-strong">Notas de entrada</h2>
        {podeCriar ? (
          <Button
            label="Nova entrada"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={() => setModalMode("create")}
          />
        ) : (
          <span className="font-sans text-sm text-[#697077]">
            Seu usuário não tem permissão para registrar entradas.
          </span>
        )}
      </div>

      <BarraFiltrosBase
        key={chaveFiltros}
        campos={camposFiltro}
        valores={valoresFiltros}
        onAplicar={aplicarFiltrosTela}
        onLimpar={limparFiltrosTela}
      />

      <DataTable
        columns={columnsEntrada}
        data={resultado.data}
        idField="id_nota_entrada"
        actions={actions}
        paginacaoServidor={{
          total: resultado.total,
          page: resultado.page,
          pageSize: resultado.limit,
          onPageChange: (page) => void carregar(page, resultado.limit),
          onPageSizeChange: (limit) => void carregar(1, limit),
        }}
        carregando={carregando || carregandoNota}
      />

      <Modal
        open={modalMode === "create"}
        onClose={fecharModal}
        title={TITULOS.create}
        width="960px"
      >
        <EntradaForm
          mode="create"
          conversoes={conversoes}
          podeCriarFornecedor={podeCriarFornecedor}
          tiposCodigoFornecedor={tiposCodigoFornecedor}
          onCancel={fecharModal}
          onSaved={aoSalvar}
        />
      </Modal>

      <Modal
        open={modalMode === "edit" && formData !== null}
        onClose={fecharModal}
        title={TITULOS.edit}
        width="960px"
      >
        {formData && (
          <EntradaForm
            mode="edit"
            initialData={formData}
            conversoes={conversoes}
            podeCriarFornecedor={podeCriarFornecedor}
            tiposCodigoFornecedor={tiposCodigoFornecedor}
            onCancel={fecharModal}
            onSaved={aoSalvar}
          />
        )}
      </Modal>

      <Modal
        open={modalMode === "view" && formData !== null}
        onClose={fecharModal}
        title={TITULOS.view}
        width="960px"
      >
        {formData && (
          <EntradaForm
            mode="view"
            initialData={formData}
            conversoes={conversoes}
            podeCriarFornecedor={false}
            tiposCodigoFornecedor={[]}
            onCancel={fecharModal}
            onSaved={aoSalvar}
          />
        )}
      </Modal>
    </div>
  );
}
