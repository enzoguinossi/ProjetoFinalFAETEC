"use client";

import { useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import type { Column } from "@/components/DataTable";
import { useAviso } from "@/components/AvisoProvider";
import type { PaginatedResult } from "@/types";
import SaidaForm from "./SaidaForm";
import { cancelarRemessa, listarNotasSaida } from "./actions";
import type { CondutorItem, NotaSaidaListRow, VeiculoItem } from "./tipos";

interface Props {
  inicialSaida: PaginatedResult<NotaSaidaListRow>;
  podeCriarSaida: boolean;
  podeCancelarRemessa: boolean;
  condutores: CondutorItem[];
  veiculos: VeiculoItem[];
}

const columnsSaida: Column<NotaSaidaListRow>[] = [
  { key: "data", label: "Data", width: "1fr", align: "left" },
  { key: "remessas", label: "Remessas", width: "0.7fr", align: "center" },
  { key: "destinatarios", label: "Destinatários", width: "3fr", align: "left" },
  { key: "status", label: "Status", width: "1fr", align: "center" },
];

export default function SaidaClient({
  inicialSaida,
  podeCriarSaida,
  podeCancelarRemessa,
  condutores,
  veiculos,
}: Props) {
  const mostrarAviso = useAviso();

  const [resultadoSaida, setResultadoSaida] = useState(inicialSaida);
  const [carregandoSaida, setCarregandoSaida] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  async function carregarSaida(page = 1, limit = resultadoSaida.limit) {
    setCarregandoSaida(true);
    try {
      const atualizado = await listarNotasSaida({ page, limit });
      setResultadoSaida(atualizado);
    } finally {
      setCarregandoSaida(false);
    }
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

            <div className="flex justify-start sm:justify-end">
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
        rowExpansivel={() => true}
        renderExpandido={renderRemessas}
        paginacaoServidor={{
          total: resultadoSaida.total,
          page: resultadoSaida.page,
          pageSize: resultadoSaida.limit,
          onPageChange: (page) => void carregarSaida(page, resultadoSaida.limit),
          onPageSizeChange: (limit) => void carregarSaida(1, limit),
        }}
        carregando={carregandoSaida}
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
    </div>
  );
}
