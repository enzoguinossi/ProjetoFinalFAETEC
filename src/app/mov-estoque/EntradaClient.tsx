"use client";

import { useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { useAviso } from "@/components/AvisoProvider";
import type { Action, Column } from "@/components/DataTable";
import type { PaginatedResult } from "@/types";
import EntradaForm from "./EntradaForm";
import { listarNotasEntrada, obterNotaEntrada } from "./actions";
import type {
  ConversaoUnidadeItem,
  NotaEntradaFormData,
  NotaEntradaListRow,
} from "./tipos";

interface Props {
  inicial: PaginatedResult<NotaEntradaListRow>;
  conversoes: ConversaoUnidadeItem[];
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

const columnsEntrada: Column<NotaEntradaListRow>[] = [
  { key: "data", label: "Data", width: "1fr", align: "left" },
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

  async function carregar(page = 1, limit = resultado.limit) {
    setCarregando(true);
    try {
      const atualizado = await listarNotasEntrada({ page, limit });
      setResultado(atualizado);
    } finally {
      setCarregando(false);
    }
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
