"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import SearchEntityModal from "@/components/SearchEntityModal";
import FornecedorForm from "@/app/fornecedores/novo/FornecedorForm";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import { COLUNAS_FORNECEDOR } from "./colunas-selecao";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import {
  criarNotaEntrada,
  getFornecedorSelecao,
  getProdutoEntrada,
  listarFornecedoresSelecao,
  listarProdutosSelecao,
} from "./actions";
import type { ConversaoUnidadeItem, FornecedorSelecaoRow } from "./tipos";

interface Props {
  conversoes: ConversaoUnidadeItem[];
  podeCriarFornecedor: boolean;
  tiposCodigoFornecedor: { id_tipo_codigo: number; nome: string }[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

/** Botão de ação só com ícone — mesmo visual dos botões de ação das tabelas. */
const ICON_BUTTON_CLASS =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)] [&_svg]:w-5 [&_svg]:h-5 [&_img]:w-5 [&_img]:h-5 shrink-0";

type ItemForm = {
  uid: number;
  id_produto: number;
  descricao: string;
  id_conversao: number | null;
  fator: string;
  quantidade: string;
};

function quantidadeConvertida(item: ItemForm): number {
  const quantidade = Number(item.quantidade);
  const fator = Number(item.fator);
  if (!Number.isFinite(quantidade) || !Number.isFinite(fator)) return 0;
  return quantidade * fator;
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);
}

let proximoUid = 1;

export default function EntradaForm({
  conversoes,
  podeCriarFornecedor,
  tiposCodigoFornecedor,
  onSaved,
  onCancel,
}: Props) {
  const mostrarAviso = useAviso();

  const [fornecedor, setFornecedor] = useState<FornecedorSelecaoRow | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [buscandoFornecedor, setBuscandoFornecedor] = useState(false);
  const [criandoFornecedor, setCriandoFornecedor] = useState(false);

  /** Fornecedor criado no diálogo interno: seleciona na nota e fecha o diálogo. */
  async function fornecedorCriado(id_fornecedor?: number) {
    setCriandoFornecedor(false);
    if (!id_fornecedor) {
      mostrarAviso("Fornecedor criado, mas não foi possível selecioná-lo na nota.", "erro");
      return;
    }
    const criado = await getFornecedorSelecao(id_fornecedor);
    if (!criado) {
      mostrarAviso("Fornecedor criado, mas não foi possível selecioná-lo na nota.", "erro");
      return;
    }
    setFornecedor(criado);
    mostrarAviso("Fornecedor criado e selecionado na nota.", "sucesso");
  }

  async function adicionarItem(produto: ProdutoListRow) {
    const detalhe = await getProdutoEntrada(produto.id_produto);
    const conversaoPadrao = detalhe?.id_conversao_padrao
      ? conversoes.find((c) => c.id_conversao === detalhe.id_conversao_padrao)
      : undefined;

    setItens((atuais) => [
      ...atuais,
      {
        uid: proximoUid++,
        id_produto: produto.id_produto,
        descricao: detalhe?.descricao ?? produto.descricao,
        id_conversao: conversaoPadrao?.id_conversao ?? null,
        fator: String(conversaoPadrao?.fator ?? detalhe?.fator_padrao ?? 1),
        quantidade: "1",
      },
    ]);
  }

  function alterarItem(uid: number, parcial: Partial<ItemForm>) {
    setItens((atuais) => atuais.map((item) => (item.uid === uid ? { ...item, ...parcial } : item)));
  }

  function removerItem(uid: number) {
    setItens((atuais) => atuais.filter((item) => item.uid !== uid));
  }

  function escolherConversao(item: ItemForm, valor: string) {
    const id = valor ? Number(valor) : null;
    const conversao = id ? conversoes.find((c) => c.id_conversao === id) : undefined;
    alterarItem(item.uid, {
      id_conversao: id,
      ...(conversao ? { fator: String(conversao.fator) } : {}),
    });
  }

  async function gravar() {
    const chave = chaveAcesso.trim();
    if (chave && chave.length !== 44) {
      mostrarAviso("A chave de acesso da NF-e deve ter 44 caracteres.", "erro");
      return;
    }
    if (itens.length === 0) {
      mostrarAviso("Informe ao menos um item na entrada.", "erro");
      return;
    }
    for (const item of itens) {
      if (!(Number(item.fator) > 0)) {
        mostrarAviso("O fator de conversão deve ser maior que zero.", "erro");
        return;
      }
      if (!(Number(item.quantidade) > 0)) {
        mostrarAviso("A quantidade deve ser maior que zero.", "erro");
        return;
      }
    }

    setSalvando(true);
    try {
      const resultado = await criarNotaEntrada({
        id_fornecedor: fornecedor?.id_fornecedor ?? null,
        data_recebimento: dataRecebimento || null,
        observacao: observacao.trim() || null,
        chaves_acesso: chave ? [chave] : [],
        itens: itens.map((item) => ({
          id_produto: item.id_produto,
          fator_conversao: Number(item.fator),
          quantidade: Number(item.quantidade),
        })),
      });
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      mostrarAviso("Entrada registrada com sucesso.", "sucesso");
      setFornecedor(null);
      setDataRecebimento("");
      setObservacao("");
      setChaveAcesso("");
      setItens([]);
      await onSaved();
    } catch {
      mostrarAviso("Erro ao gravar a entrada. Tente novamente.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={ui.form}>
      {/* Cabeçalho */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${ui.field} sm:col-span-2`}>
          <label className={LABEL_CLASS}>Fornecedor (opcional)</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={fornecedor?.razao_social ?? ""}
              placeholder="Sem fornecedor"
              className={INPUT_CLASS}
            />
            <button
              type="button"
              className={ICON_BUTTON_CLASS}
              aria-label="Selecionar fornecedor"
              title="Selecionar fornecedor"
              onClick={() => setBuscandoFornecedor(true)}
            >
              <img src="/icons/actions/Lupa.svg" alt="" />
            </button>
            {podeCriarFornecedor && (
              <button
                type="button"
                className={ICON_BUTTON_CLASS}
                aria-label="Cadastrar fornecedor"
                title="Cadastrar fornecedor"
                onClick={() => setCriandoFornecedor(true)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {fornecedor && (
              <Button label="Limpar" variant="cancel" onClick={() => setFornecedor(null)} />
            )}
          </div>
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Data de recebimento (opcional)</label>
          <input
            type="date"
            value={dataRecebimento}
            onChange={(e) => setDataRecebimento(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className={ui.field}>
          <label className={LABEL_CLASS}>Observação (opcional)</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Chave de acesso */}
      <div className={ui.field}>
        <label className={LABEL_CLASS}>Chave de acesso NF-e (opcional)</label>
        <div className="flex items-center gap-2">
          <input
            value={chaveAcesso}
            maxLength={44}
            onChange={(e) => setChaveAcesso(e.target.value)}
            placeholder="44 caracteres"
            className={INPUT_CLASS}
          />
          <span className="w-16 shrink-0 font-sans text-xs text-[#697077]">{chaveAcesso.trim().length}/44</span>
        </div>
      </div>

      {/* Itens */}
      <div className={ui.field}>
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Itens</label>
          <Button
            label="Adicionar item"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={() => setBuscandoProduto(true)}
          />
        </div>

        {itens.length === 0 ? (
          <p className="m-0 font-sans text-sm text-[#697077]">
            Nenhum item adicionado. Use &quot;Adicionar item&quot; para buscar o produto.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {itens.map((item) => {
              const convertida = quantidadeConvertida(item);
              return (
                <div
                  key={item.uid}
                  className="grid gap-3 rounded-[20px] border border-border p-3 sm:grid-cols-[2fr_1.4fr_0.8fr_0.8fr_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Produto</span>
                    <span className="font-sans text-base text-ink-strong">{item.descricao}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Conversão</span>
                    <select
                      value={item.id_conversao ?? ""}
                      onChange={(e) => escolherConversao(item, e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="">—</option>
                      {conversoes.map((c) => (
                        <option key={c.id_conversao} value={c.id_conversao}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Fator</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.fator}
                      onChange={(e) => alterarItem(item.uid, { fator: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Quantidade</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantidade}
                      onChange={(e) => alterarItem(item.uid, { quantidade: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex flex-col items-start justify-end gap-1">
                    <span className="font-sans text-xs text-[#697077]">Convertida</span>
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-base text-ink-strong">{formatarNumero(convertida)}</span>
                      <Button label="Remover" variant="cancel" onClick={() => removerItem(item.uid)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={onCancel} />
        <Button
          label={salvando ? "Gravando..." : "Gravar entrada"}
          variant="primary"
          onClick={gravar}
          disabled={salvando || itens.length === 0}
        />
      </div>

      <SearchEntityModal<FornecedorSelecaoRow>
        open={buscandoFornecedor}
        onClose={() => setBuscandoFornecedor(false)}
        onSelect={setFornecedor}
        title="Selecionar Fornecedor"
        columns={COLUNAS_FORNECEDOR}
        loadPage={listarFornecedoresSelecao}
        getItemId={(f) => f.id_fornecedor}
        placeholder="Filtrar fornecedor por razão social..."
      />

      {/* Diálogo aninhado: o Radix empilha os diálogos — foco e Escape no interno
          não fecham o modal da nota. */}
      <Modal
        open={criandoFornecedor}
        onClose={() => setCriandoFornecedor(false)}
        title="Novo fornecedor"
        width="860px"
      >
        <FornecedorForm
          mode="create"
          tiposCodigo={tiposCodigoFornecedor}
          onSuccess={(id_fornecedor) => void fornecedorCriado(id_fornecedor)}
          onCancel={() => setCriandoFornecedor(false)}
        />
      </Modal>

      <SearchEntityModal<ProdutoListRow>
        open={buscandoProduto}
        onClose={() => setBuscandoProduto(false)}
        onSelect={(produto) => void adicionarItem(produto)}
        title="Selecionar Produto"
        columns={COLUNAS_PRODUTO}
        loadPage={listarProdutosSelecao}
        excludeIds={itens.map((item) => item.id_produto)}
        getItemId={(p) => p.id_produto}
        placeholder="Filtrar produto por código ou descrição..."
      />
    </div>
  );
}
