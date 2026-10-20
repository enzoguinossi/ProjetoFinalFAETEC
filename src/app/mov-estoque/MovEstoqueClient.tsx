"use client";

import { useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import type { Column } from "@/components/DataTable";
import { useAviso } from "@/components/AvisoProvider";
import type { PaginatedResult } from "@/types";
import EntradaForm from "./EntradaForm";
import SaidaForm from "./SaidaForm";
import { cancelarRemessa, listarNotasEntrada, listarNotasSaida } from "./actions";
import type {
  CondutorItem,
  ConversaoUnidadeItem,
  NotaEntradaListRow,
  NotaSaidaListRow,
  VeiculoItem,
} from "./tipos";

interface Props {
  inicial: PaginatedResult<NotaEntradaListRow>;
  conversoes: ConversaoUnidadeItem[];
  podeCriar: boolean;
  inicialSaida: PaginatedResult<NotaSaidaListRow>;
  podeVerSaida: boolean;
  podeCriarSaida: boolean;
  podeCancelarRemessa: boolean;
  condutores: CondutorItem[];
  veiculos: VeiculoItem[];
}

type Aba = "entrada" | "saida";

const columnsEntrada: Column<NotaEntradaListRow>[] = [
  { key: "data", label: "Data", width: "1fr" },
  { key: "fornecedor", label: "Fornecedor", width: "2fr" },
  { key: "itens", label: "Itens", width: "0.7fr" },
  {
    key: "chavesTexto",
    label: "Chaves de acesso",
    width: "3fr",
    render: (_valor, row) => (
      <span title={row.chaves.join(", ")}>{row.chavesTexto}</span>
    ),
  },
];

const columnsSaida: Column<NotaSaidaListRow>[] = [
  { key: "data", label: "Data", width: "1fr" },
  { key: "remessas", label: "Remessas", width: "0.7fr" },
  { key: "destinatarios", label: "Destinatários", width: "3fr" },
  { key: "status", label: "Status", width: "1fr" },
];

const tabBase =
  "h-10 px-4 border-none rounded-t-lg bg-transparent font-sans text-base cursor-pointer transition-[background-color,color] duration-[120ms]";

export default function MovEstoqueClient({
  inicial,
  conversoes,
  podeCriar,
  inicialSaida,
  podeVerSaida,
  podeCriarSaida,
  podeCancelarRemessa,
  condutores,
  veiculos,
}: Props) {
  const mostrarAviso = useAviso();

  const [aba, setAba] = useState<Aba>("entrada");
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const [resultadoSaida, setResultadoSaida] = useState(inicialSaida);
  const [carregandoSaida, setCarregandoSaida] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [notaDetalhe, setNotaDetalhe] = useState<NotaSaidaListRow | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  async function carregar(page = 1, limit = resultado.limit) {
    setCarregando(true);
    try {
      const atualizado = await listarNotasEntrada({ page, limit });
      setResultado(atualizado);
    } finally {
      setCarregando(false);
    }
  }

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
      const notaAtualizada = atualizado.data.find(
        (nota) => nota.id_nota_saida === notaDetalhe?.id_nota_saida,
      );
      setNotaDetalhe(notaAtualizada ?? null);
    } catch {
      mostrarAviso("Erro ao cancelar a remessa. Tente novamente.", "erro");
    } finally {
      setCancelandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Abas */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 border-b border-border">
          <button
            type="button"
            className={`${tabBase} ${aba === "entrada" ? "bg-brand text-white" : "text-ink hover:bg-hover"}`}
            onClick={() => setAba("entrada")}
            aria-pressed={aba === "entrada"}
          >
            Entrada
          </button>
          <button
            type="button"
            className={`${tabBase} ${
              !podeVerSaida
                ? "text-[#697077] opacity-60 cursor-not-allowed"
                : aba === "saida"
                  ? "bg-brand text-white"
                  : "text-ink hover:bg-hover"
            }`}
            onClick={() => podeVerSaida && setAba("saida")}
            aria-pressed={aba === "saida"}
            disabled={!podeVerSaida}
            title={podeVerSaida ? undefined : "Seu usuário não tem permissão para ver saídas."}
          >
            Saída
          </button>
        </div>
      </div>

      {aba === "entrada" && (
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
                onClick={() => setModalAberto(true)}
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
            paginacaoServidor={{
              total: resultado.total,
              page: resultado.page,
              pageSize: resultado.limit,
              onPageChange: (page) => void carregar(page, resultado.limit),
              onPageSizeChange: (limit) => void carregar(1, limit),
            }}
            carregando={carregando}
          />
        </div>
      )}

      {aba === "saida" && podeVerSaida && (
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
            actions={[
              {
                icon: "/icons/actions/Olho.svg",
                label: "Ver remessas e cancelar",
                onClick: (row) => setNotaDetalhe(row),
              },
            ]}
            paginacaoServidor={{
              total: resultadoSaida.total,
              page: resultadoSaida.page,
              pageSize: resultadoSaida.limit,
              onPageChange: (page) => void carregarSaida(page, resultadoSaida.limit),
              onPageSizeChange: (limit) => void carregarSaida(1, limit),
            }}
            carregando={carregandoSaida}
          />
        </div>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Nova entrada" width="960px">
        <EntradaForm
          conversoes={conversoes}
          onCancel={() => setModalAberto(false)}
          onSaved={async () => {
            setModalAberto(false);
            await carregar(1);
          }}
        />
      </Modal>

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
        open={notaDetalhe !== null}
        onClose={() => setNotaDetalhe(null)}
        title={`Remessas da nota #${notaDetalhe?.id_nota_saida ?? ""}`}
        width="720px"
      >
        <div className="flex flex-col gap-3">
          {notaDetalhe?.listaRemessas.length === 0 && (
            <p className="m-0 font-sans text-sm text-[#697077]">Esta nota não possui remessas.</p>
          )}

          {notaDetalhe?.listaRemessas.map((remessa) => (
            <div
              key={remessa.id_remessa}
              className="grid items-center gap-3 rounded-[20px] border border-border p-4 sm:grid-cols-[0.7fr_2fr_1.2fr_auto]"
            >
              <span className="font-sans text-sm text-[#697077]">#{remessa.id_remessa}</span>
              <span className="font-sans text-base text-ink-strong">{remessa.destinatario}</span>
              <span className="font-sans text-sm text-ink">{remessa.statusLabel}</span>

              <div className="flex justify-end">
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
      </Modal>
    </div>
  );
}
