"use client";

import { useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import type { Column } from "@/components/DataTable";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo } from "@/lib/formatar";
import type { PaginatedResult } from "@/types";
import SaidaForm from "./SaidaForm";
import { cancelarNotaSaida, listarNotasSaida, obterNotaSaida } from "./actions";
import type { NotaSaidaFormData, NotaSaidaListRow } from "./tipos";

interface Props {
  inicialSaida: PaginatedResult<NotaSaidaListRow>;
  podeCriarSaida: boolean;
  /** `nota_saida.consultar`: habilita a visualização da nota. */
  podeConsultarNota: boolean;
  /** `nota_saida.alterar`: habilita a edição da nota. */
  podeAlterarNota: boolean;
  /** `nota_saida.cancelar`: habilita o cancelamento da nota. */
  podeCancelarNota: boolean;
}

type ModoModal = "view" | "edit";

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

export default function SaidaClient({
  inicialSaida,
  podeCriarSaida,
  podeConsultarNota,
  podeAlterarNota,
  podeCancelarNota,
}: Props) {
  const mostrarAviso = useAviso();

  const [resultadoSaida, setResultadoSaida] = useState(inicialSaida);
  const [carregandoSaida, setCarregandoSaida] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaSaidaListRow | null>(null);

  const [notaModal, setNotaModal] = useState<{
    mode: ModoModal;
    data: NotaSaidaFormData;
  } | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  async function carregarSaida(page = 1, limit = resultadoSaida.limit) {
    setCarregandoSaida(true);
    try {
      const atualizado = await listarNotasSaida({ page, limit });
      setResultadoSaida(atualizado);
    } finally {
      setCarregandoSaida(false);
    }
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

            {nota.itens.map((item) => (
              <div
                key={item.id_item_nota_saida}
                className="grid items-center gap-3 rounded-[1rem] bg-[rgba(0,0,0,0.03)] px-4 py-3 font-sans sm:grid-cols-[2.5fr_1fr_1fr]"
              >
                <span className="text-base text-ink-strong">{item.descricao}</span>
                <span className="text-sm text-ink">
                  {formatarNumero(item.quantidade_solicitada)}
                </span>
                <span className="text-sm text-ink">{formatarNumero(item.quantidade_entregue)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-1">
          <span className="font-sans text-sm text-[#697077]">
            {nota.quantidade > 0
              ? `Quantidade total: ${formatarNumero(nota.quantidade)}`
              : "Sem quantidade solicitada."}
          </span>
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
            onCancel={() => setNotaModal(null)}
            onSaved={async () => {
              setNotaModal(null);
              await recarregarPaginaAtual();
            }}
          />
        )}
      </Modal>

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
