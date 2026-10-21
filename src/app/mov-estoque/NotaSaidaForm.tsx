"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import { salvarNotaSaida } from "./actions";
import type { NotaSaidaFormData } from "./tipos";

interface Props {
  mode: "edit" | "view";
  initialData: NotaSaidaFormData;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

function formatarNumero(valor: number | null): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

/**
 * Visualização e edição da **nota de saída**. A edição altera apenas a
 * observação: cada remessa tem a sua própria reserva e é editada
 * individualmente pelo `RemessaForm`.
 */
export default function NotaSaidaForm({
  mode,
  initialData,
  onSaved,
  onCancel,
}: Props) {
  const mostrarAviso = useAviso();
  const isView = mode === "view";
  const [observacao, setObservacao] = useState(initialData.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  async function gravar() {
    if (isView) return;

    setSalvando(true);
    try {
      const resultado = await salvarNotaSaida(initialData.id_nota_saida, {
        observacao: observacao.trim() || null,
      });
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Nota de saída atualizada com sucesso.", "sucesso");
      await onSaved();
    } catch {
      mostrarAviso("Erro ao atualizar a nota de saída. Tente novamente.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={ui.form}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={ui.field}>
          <label className={LABEL_CLASS}>Data</label>
          <input readOnly value={initialData.data} className={INPUT_CLASS} />
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Status</label>
          <input readOnly value={initialData.status} className={INPUT_CLASS} />
        </div>
      </div>

      <div className={ui.field}>
        <label className={LABEL_CLASS}>Observação da nota</label>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Opcional"
          readOnly={isView}
          className={INPUT_CLASS}
        />
      </div>

      <div className={ui.field}>
        <label className={LABEL_CLASS}>Remessas</label>
        {initialData.remessas.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">Esta nota não possui remessas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {initialData.remessas.map((remessa) => (
              <div
                key={remessa.id_remessa}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-sans text-base text-ink-strong">
                    {remessa.destinatario}
                  </span>
                  <span className="font-sans text-sm text-[#697077]">{remessa.statusLabel}</span>
                </div>

                {remessa.itens.length === 0 ? (
                  <span className="font-sans text-sm text-[#697077]">Sem itens.</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="grid gap-3 px-1 font-sans text-xs uppercase tracking-[0.02em] text-[#697077] sm:grid-cols-[2fr_0.8fr_0.7fr_0.7fr]">
                      <span>Produto</span>
                      <span>Solicitada</span>
                      <span>Separada</span>
                      <span>Entregue</span>
                    </div>
                    {remessa.itens.map((item) => (
                      <div
                        key={item.id_item_remessa}
                        className="grid gap-3 rounded-md bg-[rgba(0,0,0,0.03)] px-3 py-2 font-sans text-sm text-ink sm:grid-cols-[2fr_0.8fr_0.7fr_0.7fr]"
                      >
                        <span className="text-ink-strong">{item.descricao}</span>
                        <span>{formatarNumero(item.quantidade_solicitada)}</span>
                        <span>{formatarNumero(item.quantidade_separada)}</span>
                        <span>{formatarNumero(item.quantidade_entregue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isView && (
        <p className="m-0 font-sans text-sm text-[#697077]">
          Só a observação da nota é editada aqui. As remessas são editadas individualmente, cada
          uma com a sua própria reserva.
        </p>
      )}

      <div className={ui.rowActions}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button
              label={salvando ? "Salvando..." : "Salvar alterações"}
              variant="primary"
              onClick={gravar}
              disabled={salvando}
            />
          </>
        )}
      </div>
    </div>
  );
}
