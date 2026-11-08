"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import BarraFiltrosBase from "@/components/relatorios/BarraFiltrosBase";
import type { CampoFiltro, Valores } from "@/components/relatorios/BarraFiltrosBase";
import type { Column } from "@/components/DataTable";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo } from "@/lib/formatar";
import type { PaginatedResult } from "@/types";
import RetiradaModal, { type NotaRetirada } from "./RetiradaModal";
import SaidaForm from "./SaidaForm";
import {
  cancelarNotaSaida,
  listarNotasSaida,
  obterNotaSaida,
  type NotaSaidaFiltrosPayload,
} from "./actions";
import type {
  DestinatarioSelecaoRow,
  NotaSaidaFormData,
  NotaSaidaListRow,
} from "./tipos";

interface Props {
  inicialSaida: PaginatedResult<NotaSaidaListRow>;
  /** Opções do filtro de destinatário. */
  destinatarios: DestinatarioSelecaoRow[];
  podeCriarSaida: boolean;
  /** `nota_saida.consultar`: habilita a visualização da nota. */
  podeConsultarNota: boolean;
  /** `nota_saida.alterar`: habilita a edição da nota. */
  podeAlterarNota: boolean;
  /** `nota_saida.cancelar`: habilita o cancelamento da nota. */
  podeCancelarNota: boolean;
  /** `expedicao.alterar`: habilita a retirada direta de itens. */
  podeRetirarNota: boolean;
}

type ModoModal = "view" | "edit";

const TIPOS_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "SAIDA", rotulo: "Remessa" },
  { valor: "DESMONTAGEM", rotulo: "Desmontagem" },
  { valor: "CONSUMO_INTERNO", rotulo: "Consumo interno" },
  { valor: "AVARIA", rotulo: "Avaria" },
];

const STATUS_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "ABERTA", rotulo: "Aberta" },
  { valor: "EM_PERCURSO", rotulo: "Em percurso" },
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "BAIXA_TOTAL", rotulo: "Baixa total" },
  { valor: "BAIXA_PARCIAL", rotulo: "Baixa parcial" },
  { valor: "BAIXA_COM_CORTE", rotulo: "Baixa com corte" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
];

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

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

export default function SaidaClient({
  inicialSaida,
  destinatarios,
  podeCriarSaida,
  podeConsultarNota,
  podeAlterarNota,
  podeCancelarNota,
  podeRetirarNota,
}: Props) {
  const mostrarAviso = useAviso();

  const [resultadoSaida, setResultadoSaida] = useState(inicialSaida);
  const [carregandoSaida, setCarregandoSaida] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaSaidaListRow | null>(null);
  const [retirada, setRetirada] = useState<NotaRetirada | null>(null);
  const [valoresFiltros, setValoresFiltros] = useState<Valores>({});
  const [chaveFiltros, setChaveFiltros] = useState(0);
  const filtrosAtuais = useRef<NotaSaidaFiltrosPayload>({});

  const camposFiltro: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    { id: "tipo", rotulo: "Tipo", tipo: "multi", opcoes: TIPOS_FILTRO },
    { id: "status", rotulo: "Status", tipo: "multi", opcoes: STATUS_FILTRO },
    {
      id: "destinatario",
      rotulo: "Destinatário",
      tipo: "multi",
      opcoes: destinatarios.map((destinatario) => ({
        valor: String(destinatario.id_destinatario),
        rotulo: destinatario.razao_social,
      })),
    },
    { id: "urgente", rotulo: "Urgente", tipo: "checkbox" },
  ];

  const [notaModal, setNotaModal] = useState<{
    mode: ModoModal;
    data: NotaSaidaFormData;
  } | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  async function carregarSaida(page = 1, limit = resultadoSaida.limit) {
    setCarregandoSaida(true);
    try {
      const atualizado = await listarNotasSaida({
        page,
        limit,
        ...filtrosAtuais.current,
      });
      setResultadoSaida(atualizado);
    } finally {
      setCarregandoSaida(false);
    }
  }

  function aplicarFiltrosTela(novos: Valores) {
    const periodo = Array.isArray(novos.periodo) ? undefined : novos.periodo;
    const tipos = Array.isArray(novos.tipo) ? novos.tipo : [];
    const status = Array.isArray(novos.status) ? novos.status : [];
    filtrosAtuais.current = {
      de: periodo?.de || undefined,
      ate: periodo?.ate || undefined,
      tipos: tipos.length > 0 ? tipos : undefined,
      status: status.length > 0 ? status : undefined,
      id_destinatario: idsNumericos(novos.destinatario),
      urgente:
        Array.isArray(novos.urgente) && novos.urgente.includes("1")
          ? true
          : undefined,
    };
    setValoresFiltros(novos);
    setChaveFiltros((chave) => chave + 1);
    void carregarSaida(1);
  }

  function limparFiltrosTela() {
    filtrosAtuais.current = {};
    setValoresFiltros({});
    setChaveFiltros((chave) => chave + 1);
    void carregarSaida(1);
  }

  /** Recarrega a página atual (depois de editar/cancelar, sem pular de página). */
  async function recarregarPaginaAtual() {
    await carregarSaida(resultadoSaida.page, resultadoSaida.limit);
  }

  async function cancelar(idNotaSaida: number) {
    setCancelandoId(idNotaSaida);
    try {
      const resultadoCancelamento = await cancelarNotaSaida(idNotaSaida);
      if ("error" in resultadoCancelamento) {
        mostrarAviso(resultadoCancelamento.error, "erro");
        return;
      }
      mostrarAviso("Nota de saída cancelada e reserva liberada.", "sucesso");
      setNotaParaCancelar(null);
      await recarregarPaginaAtual();
    } catch {
      mostrarAviso("Erro ao cancelar a nota de saída. Tente novamente.", "erro");
    } finally {
      setCancelandoId(null);
    }
  }

  async function abrirNota(row: NotaSaidaListRow, mode: ModoModal) {
    setCarregandoDetalhe(true);
    try {
      const dados = await obterNotaSaida(row.id_nota_saida, mode);
      if (!dados) {
        mostrarAviso("Não foi possível carregar a nota de saída.", "erro");
        return;
      }
      setNotaModal({ mode, data: dados });
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  /** Ações por linha: nota não-Remessa já nasce baixada, então só visualiza. */
  const columnsSaida: Column<NotaSaidaListRow>[] = [
    {
      key: "id_nota_saida",
      label: "Código",
      width: "0.9fr",
      align: "center",
      render: (value) => formatarCodigo(Number(value)),
    },
    { key: "tipoLabel", label: "Tipo", width: "1.2fr", align: "center" },
    { key: "destinatario", label: "Destinatário", width: "3fr", align: "left" },
    {
      key: "itens",
      label: "Itens",
      width: "0.9fr",
      align: "right",
      render: (_value, row) => formatarNumero(row.quantidade),
    },
    { key: "statusLabel", label: "Status", width: "1.2fr", align: "center" },
    ...(podeConsultarNota || podeAlterarNota
      ? [
          {
            key: "podeEditar" as const,
            label: "Ações",
            width: "7.5rem",
            align: "center" as const,
            render: (_: unknown, row: NotaSaidaListRow) => (
              <div className="flex items-center justify-center gap-[0.625rem]">
                {podeConsultarNota && (
                  <button
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink transition-[background-color] duration-[120ms] hover:bg-[rgba(0,0,0,0.06)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void abrirNota(row, "view");
                    }}
                    title="Visualizar"
                    type="button"
                  >
                    <img src="/icons/actions/Olho.svg" alt="Visualizar" />
                  </button>
                )}
                {podeAlterarNota && row.tipo === "SAIDA" && row.podeEditar && (
                  <button
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink transition-[background-color] duration-[120ms] hover:bg-[rgba(0,0,0,0.06)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void abrirNota(row, "edit");
                    }}
                    title="Editar"
                    type="button"
                  >
                    <img src="/icons/actions/Editar.svg" alt="Editar" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  /** Conteúdo da linha expandida: os itens da nota de saída e o cancelamento. */
  function renderItens(nota: NotaSaidaListRow) {
    const totalEntregue = nota.itens.reduce(
      (total, item) => total + item.quantidade_entregue,
      0,
    );
    return (
      <div className="flex flex-col gap-3">
        {nota.itens.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">Esta nota não possui itens.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid items-center gap-3 px-4 font-sans text-xs uppercase tracking-[0.02em] text-[#697077] sm:grid-cols-[2.5fr_1fr_1fr]">
              <span>Produto</span>
              <span>Solicitada</span>
              <span>Entregue</span>
            </div>

            {nota.itens.map((item) => {
              const entregueNaSaida = item.quantidade_entregue;
              return (
                <div
                  key={item.id_item_nota_saida}
                  className="grid items-center gap-3 rounded-[1rem] bg-[rgba(0,0,0,0.03)] px-4 py-3 font-sans sm:grid-cols-[2.5fr_1fr_1fr]"
                >
                  <span className="flex flex-col gap-0.5 text-base text-ink-strong">
                    <span>{item.descricao}</span>
                    {item.observacao?.trim() && (
                      <span className="font-sans text-xs text-[#697077]">
                        Obs.: {item.observacao}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-ink">
                    {formatarNumero(item.quantidade_solicitada)}
                  </span>
                  <span className="text-sm text-ink">
                    {formatarNumero(entregueNaSaida)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-1">
          <span className="font-sans text-sm text-[#697077]">
            {nota.quantidade > 0
              ? `Total solicitado: ${formatarNumero(nota.quantidade)} — Total entregue: ${formatarNumero(totalEntregue)}`
              : "Sem quantidade solicitada."}
          </span>
          <div className="flex items-center justify-end gap-2">
            {nota.tipo === "SAIDA" && podeRetirarNota && nota.podeRetirar && (
              <Button
                label="Retirar itens"
                variant="primary"
                onClick={() => setRetirada(nota)}
                disabled={cancelandoId !== null}
              />
            )}
            {nota.tipo !== "SAIDA" ? (
              <span className="font-sans text-xs text-[#697077]">
                Nota de {nota.tipoLabel.toLowerCase()} já baixada — histórico, sem edição ou
                cancelamento (RN004).
              </span>
            ) : podeCancelarNota && nota.podeCancelar ? (
              <Button
                label={cancelandoId === nota.id_nota_saida ? "Cancelando..." : "Cancelar nota"}
                variant="cancel"
                onClick={() => setNotaParaCancelar(nota)}
                disabled={cancelandoId !== null}
              />
            ) : nota.podeCancelar ? (
              <span className="font-sans text-xs text-[#697077]">
                Sem permissão para cancelar.
              </span>
            ) : (
              <span className="font-sans text-xs text-[#697077]">
                Não pode ser cancelada neste status.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-[590] text-ink-strong">Notas de saída</h2>
        {podeCriarSaida ? (
          <Button
            label="Nova saída"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={() => setModalSaidaAberto(true)}
          />
        ) : (
          <span className="font-sans text-sm text-[#697077]">
            Seu usuário não tem permissão para registrar saídas.
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
        columns={columnsSaida}
        data={resultadoSaida.data}
        idField="id_nota_saida"
        rowExpansivel={() => true}
        renderExpandido={renderItens}
        paginacaoServidor={{
          total: resultadoSaida.total,
          page: resultadoSaida.page,
          pageSize: resultadoSaida.limit,
          onPageChange: (page) => void carregarSaida(page, resultadoSaida.limit),
          onPageSizeChange: (limit) => void carregarSaida(1, limit),
        }}
        carregando={carregandoSaida || carregandoDetalhe}
      />

      <Modal open={modalSaidaAberto} onClose={() => setModalSaidaAberto(false)} title="Nova saída" width="960px">
        <SaidaForm
          onCancel={() => setModalSaidaAberto(false)}
          onSaved={async () => {
            setModalSaidaAberto(false);
            await carregarSaida(1);
          }}
        />
      </Modal>

      <Modal
        open={notaModal !== null}
        onClose={() => setNotaModal(null)}
        title={notaModal?.mode === "edit" ? "Editar saída" : "Detalhes da saída"}
        width="960px"
      >
        {notaModal && (
          <SaidaForm
            mode={notaModal.mode}
            initialData={notaModal.data}
            podeRetirar={podeRetirarNota}
            onRetirar={(nota) => {
              setNotaModal(null);
              setRetirada(nota);
            }}
            onCancel={() => setNotaModal(null)}
            onSaved={async () => {
              setNotaModal(null);
              await recarregarPaginaAtual();
            }}
          />
        )}
      </Modal>

      {retirada && (
        <RetiradaModal
          open
          nota={retirada}
          onClose={() => setRetirada(null)}
          onSaved={async (status) => {
            setRetirada(null);
            mostrarAviso(
              `Itens retirados. Nota agora está ${
                status === "BAIXA_TOTAL" ? "com baixa total" : "com baixa parcial"
              }.`,
              "sucesso",
            );
            await recarregarPaginaAtual();
          }}
        />
      )}

      <ConfirmDialog
        open={notaParaCancelar !== null}
        onClose={() => setNotaParaCancelar(null)}
        onConfirm={() => {
          if (notaParaCancelar) void cancelar(notaParaCancelar.id_nota_saida);
        }}
        title="Cancelar nota de saída"
        message={
          notaParaCancelar
            ? `Cancelar a nota ${formatarCodigo(notaParaCancelar.id_nota_saida)} e liberar a reserva dos itens? O histórico é preservado.`
            : ""
        }
        confirmLabel="Cancelar nota"
        loading={cancelandoId !== null}
      />
    </div>
  );
}
