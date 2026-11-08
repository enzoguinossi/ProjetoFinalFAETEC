"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo } from "@/lib/formatar";
import { ui } from "@/lib/ui";
import {
  atualizarPedido,
  criarPedido,
  getProdutoPedido,
  type EscolaSelecaoRow,
  type PedidoFormData,
  type ProdutoPedidoDetalhe,
} from "./actions";
import type { ProdutoFiltro } from "./PedidosClient";

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-ink outline-none focus:border-brand";

const LABEL_CLASS = "font-sans text-sm font-medium text-ink-strong";

type ItemForm = {
  id_produto: number;
  codigo: string;
  descricao: string;
  /** Total do item (já multiplicado pela conversão de saída no lançamento). */
  quantidade: string;
  /** Observação do item (opcional, vai para a nota na importação). */
  observacao: string;
};

interface Props {
  mode: "create" | "edit";
  initialData?: PedidoFormData;
  escolas: EscolaSelecaoRow[];
  produtos: ProdutoFiltro[];
}

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

/**
 * Formulário do pedido. O pedido é só a solicitação: a conversão padrão de
 * saída do produto é auxílio de preenchimento (calcula o total na hora) e não
 * fica gravada — o item guarda apenas o total. Produtos repetidos somam.
 */
export default function PedidoForm({
  mode,
  initialData,
  escolas,
  produtos,
}: Props) {
  const router = useRouter();
  const mostrarAviso = useAviso();

  const [idDestinatario, setIdDestinatario] = useState(
    initialData ? String(initialData.id_destinatario) : "",
  );
  const [observacao, setObservacao] = useState(initialData?.observacao ?? "");
  const [itens, setItens] = useState<ItemForm[]>(() =>
    (initialData?.itens ?? []).map((item) => ({
      id_produto: item.id_produto,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: String(item.quantidade),
      observacao: item.observacao ?? "",
    })),
  );
  const [produtoPendente, setProdutoPendente] = useState<ProdutoFiltro | null>(null);
  const [detalhe, setDetalhe] = useState<ProdutoPedidoDetalhe | null>(null);
  const [quantidadePendente, setQuantidadePendente] = useState("1");
  const [observacaoPendente, setObservacaoPendente] = useState("");
  const [salvando, setSalvando] = useState(false);

  const totalGeral = itens.reduce(
    (soma, item) => soma + (Number(item.quantidade) || 0),
    0,
  );

  async function selecionarProduto(valor: string) {
    const id = Number(valor);
    const produto = produtos.find((p) => p.id_produto === id) ?? null;
    setProdutoPendente(produto);
    setDetalhe(null);
    setQuantidadePendente("1");
    setObservacaoPendente("");
    if (!produto) return;
    setDetalhe(await getProdutoPedido(produto.id_produto));
  }

  function adicionarItem() {
    if (!produtoPendente) {
      mostrarAviso("Selecione o produto para adicionar ao pedido.", "erro");
      return;
    }
    const quantidade = Number(quantidadePendente);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      mostrarAviso("A quantidade deve ser maior que zero.", "erro");
      return;
    }

    const fator = detalhe?.fator ?? 1;
    const total = quantidade * fator;

    setItens((atuais) => {
      const existente = atuais.find(
        (item) => item.id_produto === produtoPendente.id_produto,
      );
      if (existente) {
        // Produto repetido soma no mesmo item do pedido.
        return atuais.map((item) =>
          item.id_produto === produtoPendente.id_produto
            ? {
                ...item,
                quantidade: String(Number(item.quantidade) + total),
                observacao: item.observacao || observacaoPendente.trim(),
              }
            : item,
        );
      }
      return [
        ...atuais,
        {
          id_produto: produtoPendente.id_produto,
          codigo: produtoPendente.codigo,
          descricao: produtoPendente.descricao,
          quantidade: String(total),
          observacao: observacaoPendente.trim(),
        },
      ];
    });

    setProdutoPendente(null);
    setDetalhe(null);
    setQuantidadePendente("1");
    setObservacaoPendente("");
  }

  async function gravar() {
    if (!idDestinatario) {
      mostrarAviso("Selecione a escola do pedido.", "erro");
      return;
    }
    if (itens.length === 0) {
      mostrarAviso("Informe ao menos um item no pedido.", "erro");
      return;
    }
    for (const item of itens) {
      if (!(Number(item.quantidade) > 0)) {
        mostrarAviso(
          `A quantidade de ${item.descricao} deve ser maior que zero.`,
          "erro",
        );
        return;
      }
    }

    setSalvando(true);
    try {
      const payload = {
        id_destinatario: Number(idDestinatario),
        observacao: observacao.trim() || null,
        itens: itens.map((item) => ({
          id_produto: item.id_produto,
          quantidade: Number(item.quantidade),
          observacao: item.observacao.trim() || null,
        })),
      };

      const resposta =
        mode === "edit" && initialData
          ? await atualizarPedido(initialData.id_pedido_escola, payload)
          : await criarPedido(payload);

      if ("error" in resposta) {
        mostrarAviso(resposta.error, "erro");
        return;
      }

      mostrarAviso(
        mode === "edit" ? "Pedido atualizado." : "Pedido criado.",
        "sucesso",
      );
      router.push(
        mode === "edit" && initialData
          ? `/pedidos/${initialData.id_pedido_escola}`
          : "/pedidos",
      );
      router.refresh();
    } catch {
      mostrarAviso("Não foi possível salvar o pedido.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={ui.form}>
      <div className="grid gap-4 sm:grid-cols-2">
        {initialData && (
          <div className={ui.field}>
            <label className={LABEL_CLASS}>Data</label>
            <input readOnly value={initialData.data} className={INPUT_CLASS} />
          </div>
        )}

        {initialData && (
          <div className={ui.field}>
            <label className={LABEL_CLASS}>Status</label>
            <input readOnly value={initialData.statusLabel} className={INPUT_CLASS} />
          </div>
        )}

        <div className={ui.field}>
          <label className={LABEL_CLASS} htmlFor="pedido-escola">
            Escola
          </label>
          <select
            id="pedido-escola"
            value={idDestinatario}
            onChange={(e) => setIdDestinatario(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Selecione a escola</option>
            {escolas.map((escola) => (
              <option key={escola.id_destinatario} value={escola.id_destinatario}>
                {escola.razao_social}
              </option>
            ))}
          </select>
        </div>

        <div className={`${ui.field} sm:col-span-2`}>
          <label className={LABEL_CLASS}>Observação (opcional)</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className={ui.field}>
        <label className={LABEL_CLASS}>Itens do pedido</label>
        <p className="m-0 font-sans text-sm text-[#697077]">
          A unidade de saída do produto é só auxílio: o pedido guarda o total. Produtos
          repetidos somam no mesmo item.
        </p>

        <div className="grid items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.5fr_0.9fr_0.6fr_0.7fr_0.8fr_1.2fr_auto]">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">Produto</span>
            <select
              value={produtoPendente ? String(produtoPendente.id_produto) : ""}
              onChange={(e) => void selecionarProduto(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Selecione o produto</option>
              {produtos.map((produto) => (
                <option key={produto.id_produto} value={produto.id_produto}>
                  {produto.codigo} - {produto.descricao}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">Unidade de saída</span>
            <input
              readOnly
              value={detalhe?.unidade_saida ?? ""}
              placeholder=""
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">Fator</span>
            <input
              readOnly
              value={detalhe ? formatarQuantidade(detalhe.fator) : ""}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">
              Quantidade{detalhe?.unidade_saida ? ` (${detalhe.unidade_saida})` : ""}
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={quantidadePendente}
              onChange={(e) => setQuantidadePendente(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">Total</span>
            <input
              readOnly
              value={formatarQuantidade(
                Number(quantidadePendente) * (detalhe?.fator ?? 1),
              )}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#697077]">Observação do item</span>
            <input
              value={observacaoPendente}
              onChange={(e) => setObservacaoPendente(e.target.value)}
              placeholder="Opcional"
              className={INPUT_CLASS}
            />
          </div>

          <Button
            label="Adicionar"
            variant="primary"
            onClick={adicionarItem}
            disabled={!produtoPendente}
          />
        </div>

        {itens.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">Nenhum item adicionado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {itens.map((item) => (
              <div
                key={item.id_produto}
                className="grid items-center gap-3 rounded-lg border border-border p-3 font-sans sm:grid-cols-[0.7fr_1.6fr_0.9fr_1.3fr_auto]"
              >
                <span className="text-sm text-ink-strong">
                  {item.codigo || formatarCodigo(item.id_produto)}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-ink-strong">
                  {item.descricao}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#697077]">Quantidade (total)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.quantidade}
                    onChange={(e) =>
                      setItens((atuais) =>
                        atuais.map((atual) =>
                          atual.id_produto === item.id_produto
                            ? { ...atual, quantidade: e.target.value }
                            : atual,
                        ),
                      )
                    }
                    aria-label={`Quantidade de ${item.descricao}`}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#697077]">Observação do item</span>
                  <input
                    value={item.observacao}
                    onChange={(e) =>
                      setItens((atuais) =>
                        atuais.map((atual) =>
                          atual.id_produto === item.id_produto
                            ? { ...atual, observacao: e.target.value }
                            : atual,
                        ),
                      )
                    }
                    placeholder="Opcional"
                    aria-label={`Observação de ${item.descricao}`}
                    className={INPUT_CLASS}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setItens((atuais) =>
                      atuais.filter((atual) => atual.id_produto !== item.id_produto),
                    )
                  }
                  className="cursor-pointer rounded-md border-none bg-transparent px-2 py-1 font-sans text-sm text-[#b42318] transition-[background-color] duration-100 hover:bg-[rgba(180,35,24,0.08)]"
                >
                  Remover
                </button>
              </div>
            ))}
            <span className="self-end font-sans text-sm font-semibold text-ink-strong">
              Total do pedido: {formatarQuantidade(totalGeral)}
            </span>
          </div>
        )}
      </div>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={() => router.back()} />
        <Button
          label={salvando ? "Salvando..." : "Salvar pedido"}
          variant="primary"
          onClick={() => void gravar()}
          disabled={salvando || itens.length === 0}
        />
      </div>
    </div>
  );
}
