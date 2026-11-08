"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { formatarCodigo } from "@/lib/formatar";
import { ui } from "@/lib/ui";
import { retirarItensNotaSaida } from "./actions";
import type { NotaSaidaExpedicao, NotaSaidaItemDetalhe } from "./tipos";

const EPS = 0.000001;

/** Nota mínima para a retirada: serve para a linha da lista e para a visualização. */
export type NotaRetirada = {
  id_nota_saida: number;
  status: string;
  statusLabel: string;
  urgente: boolean;
  itens: NotaSaidaItemDetalhe[];
  expedicoes: NotaSaidaExpedicao[];
};

interface Props {
  open: boolean;
  nota: NotaRetirada | null;
  onClose: () => void;
  /** Chamado com o status final da nota depois de gravar. */
  onSaved: (status: string) => Promise<void> | void;
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(
    valor,
  );
}

function pendenteDe(item: NotaSaidaItemDetalhe): number {
  return item.quantidade_solicitada - item.quantidade_entregue;
}

/**
 * Retirada direta de itens da nota de saída (RF021). Item a item, o campo
 * “Retirar agora” vem preenchido com o pendente e o que for confirmado conta
 * como entregue — a expedição continua enxergando apenas o pendente.
 */
export default function RetiradaModal({
  open,
  nota,
  onClose,
  onSaved,
}: Props) {
  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      (nota?.itens ?? [])
        .filter((item) => pendenteDe(item) > EPS)
        .map((item) => [item.id_item_nota_saida, String(pendenteDe(item))]),
    ),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!nota) return null;

  const pendentes = nota.itens.filter((item) => pendenteDe(item) > EPS);
  const completos = nota.itens.filter((item) => pendenteDe(item) <= EPS);
  const emExpedicao = nota.expedicoes.filter(
    (expedicao) =>
      expedicao.status === "PLANEJADA" ||
      expedicao.status === "EM_PERCURSO",
  );

  const invalido =
    pendentes.length === 0 ||
    pendentes.some((item) => {
      const texto = valores[item.id_item_nota_saida];
      const valor = Number(texto);
      return (
        texto === undefined ||
        texto.trim() === "" ||
        !Number.isFinite(valor) ||
        valor < 0 ||
        valor > pendenteDe(item) + EPS
      );
    }) ||
    pendentes.every(
      (item) => Number(valores[item.id_item_nota_saida] ?? 0) <= EPS,
    );

  async function confirmar() {
    if (!nota || invalido || salvando) return;

    const itens = pendentes
      .map((item) => ({
        id_item_nota_saida: item.id_item_nota_saida,
        quantidade: Number(valores[item.id_item_nota_saida] ?? 0),
      }))
      .filter((item) => item.quantidade > EPS);

    if (itens.length === 0) {
      setErro("Informe ao menos uma quantidade para retirar.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const resultado = await retirarItensNotaSaida(nota.id_nota_saida, itens);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      await onSaved(resultado.status);
    } catch {
      setErro("Erro ao retirar os itens. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Retirar itens — nota ${formatarCodigo(nota.id_nota_saida)}`}
      width="860px"
    >
      <div className={ui.form}>
        <p className="m-0 font-sans text-sm text-[#697077]">
          Nota {nota.statusLabel}
          {nota.urgente ? " · urgente" : ""}. O retirado dá baixa no saldo e na
          reserva e passa a contar como entregue.
        </p>

        {emExpedicao.map((expedicao) => (
          <p
            key={expedicao.id_expedicao}
            className="m-0 rounded-lg bg-[#fff4e5] px-3 py-2 font-sans text-sm text-[#7a4100]"
          >
            Nota na expedição EXP #{expedicao.id_expedicao} (
            {expedicao.statusLabel}). O retirado conta como entregue e a
            expedição verá apenas o pendente.
          </p>
        ))}

        {pendentes.length === 0 ? (
          <p className="m-0 rounded-[1rem] border border-border-input bg-[#f8f9fb] px-4 py-3 font-sans text-sm text-[#697077]">
            Todos os itens já foram entregues — não há o que retirar.
          </p>
        ) : (
          <div className="flex w-full flex-col overflow-x-auto rounded-[1rem] border border-[#e2e8f0]">
            <div
              className="grid min-w-[620px] bg-brand px-[0.6875rem] py-2 font-display text-sm text-white [font-weight:590]"
              style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 1fr" }}
            >
              <div>Item</div>
              <div className="text-center">Solicitada</div>
              <div className="text-center">Já entregue</div>
              <div className="text-center">Pendente</div>
              <div className="text-center">Retirar agora</div>
            </div>
            {nota.itens.map((item, indice) => {
              const pendente = pendenteDe(item);
              const completo = pendente <= EPS;
              return (
                <div
                  key={item.id_item_nota_saida}
                  className={`grid min-w-[620px] items-center px-[0.6875rem] py-2 font-sans text-sm text-ink ${
                    indice % 2 === 1 ? "bg-table-alt!" : "bg-white"
                  }`}
                  style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 1fr" }}
                >
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                    {item.descricao}
                  </div>
                  <div className="text-center">
                    {formatarNumero(item.quantidade_solicitada)}
                  </div>
                  <div className="text-center">
                    {formatarNumero(item.quantidade_entregue)}
                  </div>
                  <div className="text-center">
                    {formatarNumero(Math.max(0, pendente))}
                  </div>
                  <div className="px-1">
                    {completo ? (
                      <span className="block text-center text-xs text-[#697077]">
                        Item completo
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={pendente}
                        step="any"
                        value={valores[item.id_item_nota_saida] ?? ""}
                        onChange={(event) =>
                          setValores((atual) => ({
                            ...atual,
                            [item.id_item_nota_saida]: event.target.value,
                          }))
                        }
                        className={`${ui.input} h-9`}
                        aria-label={`Retirar agora de ${item.descricao}`}
                        disabled={salvando}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completos.length > 0 && (
          <p className="m-0 font-sans text-xs text-[#697077]">
            Itens completos não podem receber retirada.
          </p>
        )}

        {erro && (
          <p className="m-0 rounded-lg bg-[#fdecea] px-3 py-2 font-sans text-sm text-[#8a1c1c]">
            {erro}
          </p>
        )}

        <div className={ui.rowActions}>
          <Button
            label="Cancelar"
            variant="cancel"
            onClick={onClose}
            disabled={salvando}
          />
          <Button
            label={salvando ? "Retirando..." : "Confirmar retirada"}
            variant="primary"
            onClick={() => void confirmar()}
            disabled={invalido || salvando}
          />
        </div>
      </div>
    </Modal>
  );
}
