"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SearchEntityModal from "@/components/SearchEntityModal";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import { COLUNAS_DESTINATARIO } from "./colunas-selecao";
import { criarNotaSaida, listarDestinatariosSelecao, listarProdutosSelecao } from "./actions";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import type { CondutorItem, DestinatarioSelecaoRow, VeiculoItem } from "./tipos";

interface Props {
  condutores: CondutorItem[];
  veiculos: VeiculoItem[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

type ItemForm = {
  uid: number;
  id_produto: number;
  descricao: string;
  saldo_disponivel: number;
  quantidade: string;
};

type RemessaForm = {
  uid: number;
  destinatario: DestinatarioSelecaoRow | null;
  id_funcionario_condutor: string;
  id_veiculo: string;
  urgente: boolean;
  observacao: string;
  itens: ItemForm[];
};

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

let proximoUid = 1;

function novaRemessa(): RemessaForm {
  return {
    uid: proximoUid++,
    destinatario: null,
    id_funcionario_condutor: "",
    id_veiculo: "",
    urgente: false,
    observacao: "",
    itens: [],
  };
}

/** Quantidade solicitada excede o saldo disponível — apenas aviso (RN001). */
function excedeSaldo(item: ItemForm): boolean {
  const quantidade = Number(item.quantidade);
  return Number.isFinite(quantidade) && quantidade > item.saldo_disponivel;
}

export default function SaidaForm({ condutores, veiculos, onSaved, onCancel }: Props) {
  const mostrarAviso = useAviso();

  const [observacao, setObservacao] = useState("");
  const [remessas, setRemessas] = useState<RemessaForm[]>([novaRemessa()]);
  const [salvando, setSalvando] = useState(false);

  const [buscandoDestinatarioUid, setBuscandoDestinatarioUid] = useState<number | null>(null);
  const [buscandoProdutoUid, setBuscandoProdutoUid] = useState<number | null>(null);

  function alterarRemessa(uid: number, parcial: Partial<RemessaForm>) {
    setRemessas((atuais) =>
      atuais.map((remessa) => (remessa.uid === uid ? { ...remessa, ...parcial } : remessa)),
    );
  }

  function adicionarRemessa() {
    setRemessas((atuais) => [...atuais, novaRemessa()]);
  }

  function removerRemessa(uid: number) {
    setRemessas((atuais) => atuais.filter((remessa) => remessa.uid !== uid));
  }

  function adicionarItem(uidRemessa: number, produto: ProdutoListRow) {
    setRemessas((atuais) =>
      atuais.map((remessa) =>
        remessa.uid === uidRemessa
          ? {
              ...remessa,
              itens: [
                ...remessa.itens,
                {
                  uid: proximoUid++,
                  id_produto: produto.id_produto,
                  descricao: produto.descricao,
                  saldo_disponivel: Number(produto.livre),
                  quantidade: "1",
                },
              ],
            }
          : remessa,
      ),
    );
  }

  function alterarItem(uidRemessa: number, uidItem: number, quantidade: string) {
    setRemessas((atuais) =>
      atuais.map((remessa) =>
        remessa.uid === uidRemessa
          ? {
              ...remessa,
              itens: remessa.itens.map((item) =>
                item.uid === uidItem ? { ...item, quantidade } : item,
              ),
            }
          : remessa,
      ),
    );
  }

  function removerItem(uidRemessa: number, uidItem: number) {
    setRemessas((atuais) =>
      atuais.map((remessa) =>
        remessa.uid === uidRemessa
          ? { ...remessa, itens: remessa.itens.filter((item) => item.uid !== uidItem) }
          : remessa,
      ),
    );
  }

  async function gravar() {
    if (remessas.length === 0) {
      mostrarAviso("Informe ao menos uma remessa na saída.", "erro");
      return;
    }
    for (const remessa of remessas) {
      if (!remessa.destinatario) {
        mostrarAviso("Selecione o destinatário de cada remessa.", "erro");
        return;
      }
      if (remessa.itens.length === 0) {
        mostrarAviso("Informe ao menos um item em cada remessa.", "erro");
        return;
      }
      const ids = new Set<number>();
      for (const item of remessa.itens) {
        if (!(Number(item.quantidade) > 0)) {
          mostrarAviso("A quantidade solicitada deve ser maior que zero.", "erro");
          return;
        }
        if (ids.has(item.id_produto)) {
          mostrarAviso("O mesmo produto não pode aparecer mais de uma vez na mesma remessa.", "erro");
          return;
        }
        ids.add(item.id_produto);
      }
    }

    setSalvando(true);
    try {
      const resultado = await criarNotaSaida({
        observacao: observacao.trim() || null,
        remessas: remessas.map((remessa) => ({
          id_destinatario: remessa.destinatario!.id_destinatario,
          id_funcionario_condutor: remessa.id_funcionario_condutor
            ? Number(remessa.id_funcionario_condutor)
            : null,
          id_veiculo: remessa.id_veiculo ? Number(remessa.id_veiculo) : null,
          urgente: remessa.urgente,
          observacao: remessa.observacao.trim() || null,
          itens: remessa.itens.map((item) => ({
            id_produto: item.id_produto,
            quantidade_solicitada: Number(item.quantidade),
          })),
        })),
      });
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Saída registrada com sucesso.", "sucesso");
      setObservacao("");
      setRemessas([novaRemessa()]);
      await onSaved();
    } catch {
      mostrarAviso("Erro ao gravar a saída. Tente novamente.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={ui.form}>
      <div className={ui.field}>
        <label className={LABEL_CLASS}>Observação da nota (opcional)</label>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Opcional"
          className={INPUT_CLASS}
        />
      </div>

      <div className={ui.field}>
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Remessas</label>
          <Button
            label="Adicionar remessa"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={adicionarRemessa}
          />
        </div>

        <div className="flex flex-col gap-4">
          {remessas.map((remessa, indice) => (
            <div
              key={remessa.uid}
              className="flex flex-col gap-3 rounded-[20px] border border-border p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-base text-ink-strong">Remessa {indice + 1}</span>
                {remessas.length > 1 && (
                  <Button label="Remover remessa" variant="cancel" onClick={() => removerRemessa(remessa.uid)} />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={ui.field}>
                  <label className={LABEL_CLASS}>Destinatário</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={remessa.destinatario?.razao_social ?? ""}
                      placeholder="Obrigatório"
                      className={INPUT_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => setBuscandoDestinatarioUid(remessa.uid)}
                      aria-label="Selecionar destinatário"
                      title="Selecionar destinatário"
                      className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-border-input bg-white text-brand cursor-pointer disabled:cursor-wait disabled:opacity-60"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className={ui.field}>
                  <label className={LABEL_CLASS}>Condutor (opcional)</label>
                  <select
                    value={remessa.id_funcionario_condutor}
                    onChange={(e) => alterarRemessa(remessa.uid, { id_funcionario_condutor: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">—</option>
                    {condutores.map((c) => (
                      <option key={c.id_funcionario} value={c.id_funcionario}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={ui.field}>
                  <label className={LABEL_CLASS}>Veículo (opcional)</label>
                  <select
                    value={remessa.id_veiculo}
                    onChange={(e) => alterarRemessa(remessa.uid, { id_veiculo: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">—</option>
                    {veiculos.map((v) => (
                      <option key={v.id_veiculo} value={v.id_veiculo}>
                        {v.modelo ? `${v.placa} — ${v.modelo}` : v.placa}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={ui.field}>
                  <label className={LABEL_CLASS}>Observação (opcional)</label>
                  <input
                    value={remessa.observacao}
                    onChange={(e) => alterarRemessa(remessa.uid, { observacao: e.target.value })}
                    placeholder="Opcional"
                    className={INPUT_CLASS}
                  />
                </div>

                <label className="flex items-center gap-2 font-sans text-sm text-ink-strong sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={remessa.urgente}
                    onChange={(e) => alterarRemessa(remessa.uid, { urgente: e.target.checked })}
                    className="h-4 w-4 accent-brand"
                  />
                  Urgente
                </label>
              </div>

              <div className={ui.field}>
                <div className="flex items-center justify-between">
                  <label className={LABEL_CLASS}>Itens da remessa</label>
                  <Button label="Adicionar item" variant="ghost" onClick={() => setBuscandoProdutoUid(remessa.uid)} />
                </div>

                {remessa.itens.length === 0 ? (
                  <p className="m-0 font-sans text-sm text-[#697077]">
                    Nenhum item adicionado. Use &quot;Adicionar item&quot; para buscar o produto.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {remessa.itens.map((item) => (
                      <div
                        key={item.uid}
                        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[2fr_0.8fr_1.6fr_auto]"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-sans text-xs text-[#697077]">Produto</span>
                          <span className="font-sans text-base text-ink-strong">{item.descricao}</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-sans text-xs text-[#697077]">Solicitada</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantidade}
                            onChange={(e) => alterarItem(remessa.uid, item.uid, e.target.value)}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-sans text-xs text-[#697077]">Disponível</span>
                          <span className="font-sans text-base text-ink-strong">
                            {formatarNumero(item.saldo_disponivel)}
                          </span>
                          {excedeSaldo(item) && (
                            <span className="font-sans text-xs text-warning">
                              Quantidade acima do disponível — a saída será gravada mesmo assim
                              (RN001).
                            </span>
                          )}
                        </div>

                        <div className="flex items-end justify-end">
                          <Button label="Remover" variant="cancel" onClick={() => removerItem(remessa.uid, item.uid)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={onCancel} />
        <Button
          label={salvando ? "Gravando..." : "Gravar saída"}
          variant="primary"
          onClick={gravar}
          disabled={salvando}
        />
      </div>

      <SearchEntityModal<DestinatarioSelecaoRow>
        open={buscandoDestinatarioUid !== null}
        onClose={() => setBuscandoDestinatarioUid(null)}
        onSelect={(destinatario) => {
          if (buscandoDestinatarioUid !== null) {
            alterarRemessa(buscandoDestinatarioUid, { destinatario });
          }
        }}
        title="Selecionar Destinatário"
        columns={COLUNAS_DESTINATARIO}
        loadPage={listarDestinatariosSelecao}
        getItemId={(d) => d.id_destinatario}
        placeholder="Filtrar destinatário por razão social..."
      />

      {buscandoProdutoUid !== null && (
        <SearchEntityModal<ProdutoListRow>
          open
          onClose={() => setBuscandoProdutoUid(null)}
          onSelect={(produto) => adicionarItem(buscandoProdutoUid, produto)}
          title="Selecionar Produto"
          columns={COLUNAS_PRODUTO}
          loadPage={listarProdutosSelecao}
          excludeIds={
            remessas.find((remessa) => remessa.uid === buscandoProdutoUid)?.itens.map(
              (item) => item.id_produto,
            ) ?? []
          }
          getItemId={(p) => p.id_produto}
          placeholder="Filtrar produto por código ou descrição..."
        />
      )}
    </div>
  );
}
