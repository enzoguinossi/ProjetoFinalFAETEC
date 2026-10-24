"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SearchEntityModal from "@/components/SearchEntityModal";
import { useAviso } from "@/components/AvisoProvider";
import { formatarCodigo } from "@/lib/formatar";
import { ui } from "@/lib/ui";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import { COLUNAS_DESTINATARIO } from "./colunas-selecao";
import {
  atualizarNotaSaida,
  criarNotaSaida,
  listarDestinatariosSelecao,
  listarProdutosSelecao,
} from "./actions";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import type {
  DestinatarioSelecaoRow,
  NotaSaidaFormData,
  TipoSaidaPayload,
} from "./tipos";

type Modo = "create" | "view" | "edit";

interface Props {
  mode?: Modo;
  initialData?: NotaSaidaFormData;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

type ItemForm = {
  uid: number;
  /** Item já gravado na nota (`null` = item novo, ainda não salvo). */
  id_item_nota_saida: number | null;
  id_produto: number;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: string;
};

const TIPOS_SAIDA: { valor: TipoSaidaPayload; rotulo: string }[] = [
  { valor: "SAIDA", rotulo: "Remessa" },
  { valor: "AVARIA", rotulo: "Avaria" },
  { valor: "CONSUMO_INTERNO", rotulo: "Consumo Interno" },
];

function rotuloTipo(tipo: TipoSaidaPayload): string {
  return TIPOS_SAIDA.find((item) => item.valor === tipo)?.rotulo ?? "Remessa";
}

let proximoUid = 1;

/**
 * Formulário único da saída. O tipo define o comportamento: Remessa leva
 * destinatário, urgência e reserva; Avaria e Consumo Interno não têm
 * destinatário e dão baixa real no estoque ao gravar a nota.
 */
export default function SaidaForm({ mode = "create", initialData, onSaved, onCancel }: Props) {
  const mostrarAviso = useAviso();
  const isView = mode === "view";
  const podeEditar = mode === "create" || (mode === "edit" && initialData?.podeEditar === true);

  const [tipo, setTipo] = useState<TipoSaidaPayload>(initialData?.tipo ?? "SAIDA");
  const [destinatario, setDestinatario] = useState<DestinatarioSelecaoRow | null>(
    initialData?.id_destinatario
      ? {
          id_destinatario: initialData.id_destinatario,
          razao_social: initialData.destinatario ?? "",
          tipo: "",
        }
      : null,
  );
  const [urgente, setUrgente] = useState(initialData?.urgente ?? false);
  const [observacao, setObservacao] = useState(initialData?.observacao ?? "");
  const [itens, setItens] = useState<ItemForm[]>(() =>
    (initialData?.itens ?? []).map((item) => ({
      uid: proximoUid++,
      id_item_nota_saida: item.id_item_nota_saida,
      id_produto: item.id_produto,
      codigo: formatarCodigo(item.id_produto),
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: String(item.quantidade_solicitada),
    })),
  );
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtoPendente, setProdutoPendente] = useState<ProdutoListRow | null>(null);
  const [quantidadePendente, setQuantidadePendente] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [buscandoDestinatario, setBuscandoDestinatario] = useState(false);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [buscaInicialProduto, setBuscaInicialProduto] = useState("");
  const [sessaoBuscaProduto, setSessaoBuscaProduto] = useState(0);

  const ehRemessa = tipo === "SAIDA";

  function alterarTipo(valor: TipoSaidaPayload) {
    setTipo(valor);
    if (valor !== "SAIDA") {
      // Avaria/Consumo Interno não têm destinatário nem urgência.
      setDestinatario(null);
      setUrgente(false);
      setBuscandoDestinatario(false);
    }
  }

  function alterarItem(uid: number, quantidade: string) {
    setItens((atuais) =>
      atuais.map((item) => (item.uid === uid ? { ...item, quantidade } : item)),
    );
  }

  function removerItem(uid: number) {
    // Só itens novos (ainda não gravados) podem sair: apagar um item já
    // registrado perderia a rastreabilidade (RN004).
    setItens((atuais) =>
      atuais.filter((item) => item.uid !== uid || item.id_item_nota_saida !== null),
    );
  }

  function abrirBuscaProduto() {
    setBuscaInicialProduto(buscaProduto.trim());
    setSessaoBuscaProduto((atual) => atual + 1);
    setBuscandoProduto(true);
  }

  function selecionarProduto(produto: ProdutoListRow) {
    setProdutoPendente(produto);
    setQuantidadePendente("1");
  }

  function adicionarItemPendente() {
    if (!produtoPendente) {
      mostrarAviso("Selecione o produto para adicionar à nota.", "erro");
      return;
    }

    const quantidade = Number(quantidadePendente);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      mostrarAviso("A quantidade deve ser maior que zero.", "erro");
      return;
    }

    if (itens.some((item) => item.id_produto === produtoPendente.id_produto)) {
      mostrarAviso(
        "O mesmo produto não pode aparecer mais de uma vez na mesma nota de saída.",
        "erro",
      );
      return;
    }

    setItens((atuais) => [
      ...atuais,
      {
        uid: proximoUid++,
        id_item_nota_saida: null,
        id_produto: produtoPendente.id_produto,
        codigo: produtoPendente.codigo,
        descricao: produtoPendente.descricao,
        unidade: produtoPendente.unidade,
        quantidade: String(quantidade),
      },
    ]);
    setProdutoPendente(null);
    setBuscaProduto("");
    setQuantidadePendente("1");
  }

  async function gravar() {
    if (!podeEditar) return;

    if (ehRemessa && !destinatario) {
      mostrarAviso("Selecione o destinatário da nota de saída.", "erro");
      return;
    }
    if (itens.length === 0) {
      mostrarAviso("Informe ao menos um item na nota de saída.", "erro");
      return;
    }
    const ids = new Set<number>();
    for (const item of itens) {
      if (!(Number(item.quantidade) > 0)) {
        mostrarAviso("A quantidade solicitada deve ser maior que zero.", "erro");
        return;
      }
      if (ids.has(item.id_produto)) {
        mostrarAviso(
          "O mesmo produto não pode aparecer mais de uma vez na mesma nota de saída.",
          "erro",
        );
        return;
      }
      ids.add(item.id_produto);
    }

    setSalvando(true);
    try {
      const itensPayload = itens.map((item) => ({
        id_item_nota_saida: item.id_item_nota_saida,
        id_produto: item.id_produto,
        quantidade_solicitada: Number(item.quantidade),
      }));

      if (mode === "edit" && initialData) {
        const resultado = await atualizarNotaSaida(initialData.id_nota_saida, {
          id_destinatario: destinatario?.id_destinatario ?? 0,
          urgente,
          observacao: observacao.trim() || null,
          itens: itensPayload,
        });
        if ("error" in resultado) {
          mostrarAviso(resultado.error, "erro");
          return;
        }
        mostrarAviso("Nota de saída atualizada com sucesso.", "sucesso");
      } else {
        const resultado = await criarNotaSaida({
          tipo,
          id_destinatario: ehRemessa ? (destinatario?.id_destinatario ?? null) : null,
          urgente: ehRemessa ? urgente : false,
          observacao: observacao.trim() || null,
          itens: itensPayload.map(({ id_produto, quantidade_solicitada }) => ({
            id_produto,
            quantidade_solicitada,
          })),
        });
        if ("error" in resultado) {
          mostrarAviso(resultado.error, "erro");
          return;
        }
        if (resultado.aviso) mostrarAviso(resultado.aviso, "cautela");
        mostrarAviso(
          ehRemessa
            ? "Remessa registrada com sucesso."
            : `${rotuloTipo(tipo)} registrada com baixa no estoque.`,
          "sucesso",
        );
        setTipo("SAIDA");
        setDestinatario(null);
        setUrgente(false);
        setObservacao("");
        setItens([]);
        setBuscaProduto("");
        setProdutoPendente(null);
        setQuantidadePendente("1");
      }
      await onSaved();
    } catch {
      mostrarAviso(
        mode === "edit"
          ? "Erro ao atualizar a nota de saída. Tente novamente."
          : "Erro ao gravar a saída. Tente novamente.",
        "erro",
      );
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
          <label className={LABEL_CLASS} htmlFor="tipo-saida">
            Tipo de Saída
          </label>
          {mode === "create" ? (
            <select
              id="tipo-saida"
              value={tipo}
              onChange={(e) => alterarTipo(e.target.value as TipoSaidaPayload)}
              className={INPUT_CLASS}
            >
              {TIPOS_SAIDA.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          ) : (
            <input readOnly value={initialData?.tipoLabel ?? rotuloTipo(tipo)} className={INPUT_CLASS} />
          )}
        </div>

        {ehRemessa && (
          <div className={ui.field}>
            <label className={LABEL_CLASS}>Destinatário</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={destinatario?.razao_social ?? ""}
                placeholder="Obrigatório"
                className={INPUT_CLASS}
              />
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setBuscandoDestinatario(true)}
                  aria-label="Selecionar destinatário"
                  title="Selecionar destinatário"
                  className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-border-input bg-white text-brand cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className={`${ui.field} sm:col-span-2`}>
          <label className={LABEL_CLASS}>Observação (opcional)</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            readOnly={!podeEditar}
            className={INPUT_CLASS}
          />
        </div>

        {ehRemessa && (
          <label className="flex items-center gap-2 font-sans text-sm text-ink-strong sm:col-span-2">
            <input
              type="checkbox"
              checked={urgente}
              onChange={(e) => setUrgente(e.target.checked)}
              disabled={!podeEditar}
              className="h-4 w-4 accent-brand"
            />
            Urgente
          </label>
        )}
      </div>

      {!ehRemessa && (
        <p className="m-0 font-sans text-sm text-[#697077]">
          A baixa no estoque será feita ao gravar a nota.
        </p>
      )}

      {!isView && mode === "edit" && initialData?.podeEditar === false && (
        <p className="m-0 font-sans text-sm text-[#697077]">
          Esta nota está {initialData.statusLabel.toLowerCase()} e não pode ser editada — o
          histórico é preservado (RN004).
        </p>
      )}

      <div className={ui.field}>
        <label className={LABEL_CLASS}>Itens da nota</label>

        {podeEditar && (
          <>
            <p className="m-0 font-sans text-sm text-[#697077]">
              Itens já registrados podem ter a quantidade corrigida, mas não podem ser removidos — a
              nota preserva a rastreabilidade.
            </p>

            <div className="grid items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.3fr_1.5fr_0.6fr_0.7fr_auto]">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs text-[#697077]">Código ou Descrição</span>
                <div className="flex items-center gap-2">
                  <input
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        abrirBuscaProduto();
                      }
                    }}
                    placeholder="Buscar produto..."
                    className={INPUT_CLASS}
                  />
                  <button
                    type="button"
                    onClick={abrirBuscaProduto}
                    aria-label="Buscar produto"
                    title="Buscar produto"
                    className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-border-input bg-white text-brand cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs text-[#697077]">Descrição</span>
                <input
                  readOnly
                  value={produtoPendente?.descricao ?? ""}
                  placeholder="—"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs text-[#697077]">Unidade</span>
                <input
                  readOnly
                  value={produtoPendente?.unidade ?? ""}
                  placeholder="—"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs text-[#697077]">Quantidade</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantidadePendente}
                  onChange={(e) => setQuantidadePendente(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <Button
                label="Adicionar"
                variant="primary"
                onClick={adicionarItemPendente}
                disabled={!produtoPendente}
              />
            </div>
          </>
        )}

        {itens.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">
            Nenhum item adicionado.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid gap-3 bg-[#f2f4f8] px-3 py-2 font-sans text-xs uppercase tracking-[0.02em] text-[#697077] sm:grid-cols-[0.8fr_2fr_0.7fr_0.9fr_7.5rem]">
              <span>Código</span>
              <span>Descrição</span>
              <span>Unidade</span>
              <span>Quantidade</span>
              <span className="text-center">Ações</span>
            </div>

            {itens.map((item) => (
              <div
                key={item.uid}
                className="grid items-center gap-3 border-t border-border px-3 py-2 font-sans sm:grid-cols-[0.8fr_2fr_0.7fr_0.9fr_7.5rem]"
              >
                <span className="text-sm text-ink-strong">{item.codigo}</span>
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-ink-strong">
                  {item.descricao}
                </span>
                <span className="text-sm text-ink">{item.unidade}</span>
                <span>
                  {podeEditar ? (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantidade}
                      onChange={(e) => alterarItem(item.uid, e.target.value)}
                      aria-label={`Quantidade de ${item.descricao}`}
                      className={INPUT_CLASS}
                    />
                  ) : (
                    <span className="text-sm text-ink">
                      {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(
                        Number(item.quantidade),
                      )}
                    </span>
                  )}
                </span>
                <div className="flex items-center justify-center">
                  {podeEditar && item.id_item_nota_saida === null ? (
                    <button
                      type="button"
                      onClick={() => removerItem(item.uid)}
                      className="cursor-pointer rounded-md border-none bg-transparent px-2 py-1 font-sans text-sm text-[#b42318] transition-[background-color] duration-100 hover:bg-[rgba(180,35,24,0.08)]"
                    >
                      Remover
                    </button>
                  ) : (
                    <span className="text-sm text-[#697077]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={ui.rowActions}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button
              label={
                salvando
                  ? "Salvando..."
                  : mode === "edit"
                    ? "Salvar alterações"
                    : "Gravar saída"
              }
              variant="primary"
              onClick={gravar}
              disabled={salvando || (mode === "edit" && !initialData?.podeEditar) || itens.length === 0}
            />
          </>
        )}
      </div>

      <SearchEntityModal<DestinatarioSelecaoRow>
        open={buscandoDestinatario}
        onClose={() => setBuscandoDestinatario(false)}
        onSelect={setDestinatario}
        title="Selecionar Destinatário"
        columns={COLUNAS_DESTINATARIO}
        loadPage={listarDestinatariosSelecao}
        getItemId={(d) => d.id_destinatario}
        placeholder="Filtrar destinatário por razão social..."
      />

      <SearchEntityModal<ProdutoListRow>
        key={sessaoBuscaProduto}
        open={buscandoProduto}
        onClose={() => setBuscandoProduto(false)}
        onSelect={selecionarProduto}
        title="Selecionar Produto"
        columns={COLUNAS_PRODUTO}
        loadPage={listarProdutosSelecao}
        excludeIds={itens.map((item) => item.id_produto)}
        getItemId={(p) => p.id_produto}
        placeholder="Filtrar produto por código ou descrição..."
        initialSearch={buscaInicialProduto}
      />
    </div>
  );
}
