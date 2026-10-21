"use client";

import { useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import type { Action, Column } from "@/components/DataTable";
import { useAviso } from "@/components/AvisoProvider";
import type { PaginatedResult } from "@/types";
import SaidaForm from "./SaidaForm";
import NotaSaidaForm from "./NotaSaidaForm";
import RemessaForm from "./RemessaForm";
import { cancelarRemessa, listarNotasSaida, obterNotaSaida, obterRemessa } from "./actions";
import type {
  CondutorItem,
  NotaSaidaFormData,
  NotaSaidaListRow,
  RemessaFormData,
  VeiculoItem,
} from "./tipos";

interface Props {
  inicialSaida: PaginatedResult<NotaSaidaListRow>;
  podeCriarSaida: boolean;
  podeCancelarRemessa: boolean;
  /** `nota_saida.consultar`: habilita a visualização da nota. */
  podeConsultarNota: boolean;
  /** `nota_saida.alterar`: habilita a edição da observação da nota. */
  podeAlterarNota: boolean;
  /** `remessa.consultar`: habilita a visualização da remessa. */
  podeConsultarRemessa: boolean;
  /** `remessa.alterar`: habilita a edição da remessa. */
  podeAlterarRemessa: boolean;
  condutores: CondutorItem[];
  veiculos: VeiculoItem[];
}

type ModoModal = "view" | "edit";

const columnsSaida: Column<NotaSaidaListRow>[] = [
  { key: "data", label: "Data", width: "1fr", align: "left" },
  { key: "remessas", label: "Remessas", width: "0.7fr", align: "center" },
  { key: "destinatarios", label: "Destinatários", width: "3fr", align: "left" },
  { key: "status", label: "Status", width: "1fr", align: "center" },
];

const ICONE_ACTION_CLS =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)] disabled:cursor-wait disabled:opacity-60";

export default function SaidaClient({
  inicialSaida,
  podeCriarSaida,
  podeCancelarRemessa,
  podeConsultarNota,
  podeAlterarNota,
  podeConsultarRemessa,
  podeAlterarRemessa,
  condutores,
  veiculos,
}: Props) {
  const mostrarAviso = useAviso();

  const [resultadoSaida, setResultadoSaida] = useState(inicialSaida);
  const [carregandoSaida, setCarregandoSaida] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  const [notaModal, setNotaModal] = useState<{
    mode: ModoModal;
    data: NotaSaidaFormData;
  } | null>(null);
  const [remessaModal, setRemessaModal] = useState<{
    mode: ModoModal;
    data: RemessaFormData;
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

  async function cancelar(idRemessa: number) {
    setCancelandoId(idRemessa);
    try {
      const resultadoCancelamento = await cancelarRemessa(idRemessa);
      if ("error" in resultadoCancelamento) {
        mostrarAviso(resultadoCancelamento.error, "erro");
        return;
      }
      mostrarAviso("Remessa cancelada e reserva liberada.", "sucesso");

      const atualizado = await listarNotasSaida({
        page: resultadoSaida.page,
        limit: resultadoSaida.limit,
      });
      setResultadoSaida(atualizado);
    } catch {
      mostrarAviso("Erro ao cancelar a remessa. Tente novamente.", "erro");
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

  async function abrirRemessa(idRemessa: number, mode: ModoModal) {
    setCarregandoDetalhe(true);
    try {
      const dados = await obterRemessa(idRemessa, mode);
      if (!dados) {
        mostrarAviso("Não foi possível carregar a remessa.", "erro");
        return;
      }
      setRemessaModal({ mode, data: dados });
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  const acoesNota: Action<NotaSaidaListRow>[] = [
    ...(podeConsultarNota
      ? [
          {
            icon: "/icons/actions/Olho.svg",
            label: "Visualizar",
            onClick: (row: NotaSaidaListRow) => {
              void abrirNota(row, "view");
            },
          },
        ]
      : []),
    ...(podeAlterarNota
      ? [
          {
            icon: "/icons/actions/Editar.svg",
            label: "Editar",
            onClick: (row: NotaSaidaListRow) => {
              void abrirNota(row, "edit");
            },
          },
        ]
      : []),
  ];

  /** Conteúdo da linha expandida: as remessas da nota de saída. */
  function renderRemessas(nota: NotaSaidaListRow) {
    if (nota.listaRemessas.length === 0) {
      return (
        <p className="m-0 font-sans text-sm text-[#697077]">
          Esta nota não possui remessas.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="grid items-center gap-3 px-4 font-sans text-xs uppercase tracking-[0.02em] text-[#697077] sm:grid-cols-[1fr_2.5fr_0.9fr_1.4fr_auto]">
          <span>Destinatário</span>
          <span>Nome</span>
          <span>Produtos</span>
          <span>Status</span>
          <span className="sr-only">Ações</span>
        </div>

        {nota.listaRemessas.map((remessa) => (
          <div
            key={remessa.id_remessa}
            className="grid items-center gap-3 rounded-[1rem] bg-[rgba(0,0,0,0.03)] px-4 py-3 font-sans sm:grid-cols-[1fr_2.5fr_0.9fr_1.4fr_auto]"
          >
            <span className="text-sm text-[#697077]">
              #{remessa.id_destinatario}
            </span>
            <span className="text-base text-ink-strong">{remessa.destinatario}</span>
            <span className="text-sm text-ink">{remessa.produtos}</span>
            <span className="text-sm text-ink">{remessa.statusLabel}</span>

            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              {podeConsultarRemessa && (
                <button
                  type="button"
                  title="Visualizar remessa"
                  aria-label="Visualizar remessa"
                  onClick={() => void abrirRemessa(remessa.id_remessa, "view")}
                  className={ICONE_ACTION_CLS}
                  disabled={carregandoDetalhe}
                >
                  <img
                    src="/icons/actions/Olho.svg"
                    alt="Visualizar remessa"
                    className="h-5 w-5"
                  />
                </button>
              )}

              {podeAlterarRemessa && remessa.podeEditar && (
                <button
                  type="button"
                  title="Editar remessa"
                  aria-label="Editar remessa"
                  onClick={() => void abrirRemessa(remessa.id_remessa, "edit")}
                  className={ICONE_ACTION_CLS}
                  disabled={carregandoDetalhe}
                >
                  <img
                    src="/icons/actions/Editar.svg"
                    alt="Editar remessa"
                    className="h-5 w-5"
                  />
                </button>
              )}

              {podeCancelarRemessa && remessa.podeCancelar ? (
                <Button
                  label={cancelandoId === remessa.id_remessa ? "Cancelando..." : "Cancelar remessa"}
                  variant="cancel"
                  onClick={() => void cancelar(remessa.id_remessa)}
                  disabled={cancelandoId !== null}
                />
              ) : remessa.podeCancelar ? (
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
        ))}
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
        actions={acoesNota}
        rowExpansivel={() => true}
        renderExpandido={renderRemessas}
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
          condutores={condutores}
          veiculos={veiculos}
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
          <NotaSaidaForm
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

      <Modal
        open={remessaModal !== null}
        onClose={() => setRemessaModal(null)}
        title={remessaModal?.mode === "edit" ? "Editar remessa" : "Detalhes da remessa"}
        width="960px"
      >
        {remessaModal && (
          <RemessaForm
            mode={remessaModal.mode}
            initialData={remessaModal.data}
            condutores={condutores}
            veiculos={veiculos}
            onCancel={() => setRemessaModal(null)}
            onSaved={async () => {
              setRemessaModal(null);
              await recarregarPaginaAtual();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
