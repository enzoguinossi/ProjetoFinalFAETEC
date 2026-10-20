"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SearchEntityModal from "@/components/SearchEntityModal";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import {
  buscarFornecedoresEntrada,
  buscarProdutosEntrada,
  criarNotaEntrada,
  getProdutoEntrada,
} from "./actions";
import type {
  ConversaoUnidadeItem,
  FornecedorBuscaItem,
  ProdutoBuscaItem,
} from "./tipos";

interface Props {
  conversoes: ConversaoUnidadeItem[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

type ItemForm = {
  uid: number;
  id_produto: number;
  descricao: string;
  id_conversao: number | null;
  fator: string;
  quantidade: string;
};

const INPUT_CLASS =
  "h-10 px-3 border border-border-input rounded-lg font-sans text-base outline-none w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";

const LABEL_CLASS = "font-sans text-sm text-ink-strong";

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

export default function EntradaForm({ conversoes, onSaved, onCancel }: Props) {
  const mostrarAviso = useAviso();

  const [fornecedor, setFornecedor] = useState<FornecedorBuscaItem | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [chaves, setChaves] = useState<string[]>([""]);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [buscandoFornecedor, setBuscandoFornecedor] = useState(false);

  function adicionarChave() {
    setChaves((atuais) => [...atuais, ""]);
  }

  function alterarChave(indice: number, valor: string) {
    setChaves((atuais) => atuais.map((c, i) => (i === indice ? valor : c)));
  }

  function removerChave(indice: number) {
    setChaves((atuais) => atuais.filter((_, i) => i !== indice));
  }

  async function adicionarItem(produto: ProdutoBuscaItem) {
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
    const chavesPreenchidas = chaves.map((c) => c.trim()).filter(Boolean);
    const chaveInvalida = chavesPreenchidas.find((c) => c.length !== 44);
    if (chaveInvalida) {
      mostrarAviso("Cada chave de acesso da NF-e deve ter 44 caracteres.", "erro");
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
        chaves_acesso: chavesPreenchidas,
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
      setChaves([""]);
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
            <Button label={fornecedor ? "Alterar" : "Selecionar"} variant="ghost" onClick={() => setBuscandoFornecedor(true)} />
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

      {/* Chaves de acesso */}
      <div className={ui.field}>
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Chaves de acesso NF-e (opcionais)</label>
          <Button label="Adicionar chave" variant="ghost" onClick={adicionarChave} />
        </div>
        {chaves.length === 0 && (
          <p className="m-0 font-sans text-sm text-[#697077]">Nenhuma chave informada.</p>
        )}
        {chaves.map((chave, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <input
              value={chave}
              maxLength={44}
              onChange={(e) => alterarChave(indice, e.target.value)}
              placeholder="44 caracteres"
              className={INPUT_CLASS}
            />
            <span className="w-16 shrink-0 font-sans text-xs text-[#697077]">{chave.trim().length}/44</span>
            <Button label="Remover" variant="cancel" onClick={() => removerChave(indice)} />
          </div>
        ))}
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

      <SearchEntityModal<FornecedorBuscaItem>
        open={buscandoFornecedor}
        onClose={() => setBuscandoFornecedor(false)}
        onSelect={setFornecedor}
        placeholder="Buscar fornecedor por razão social..."
        searchAction={buscarFornecedoresEntrada}
        getItemId={(f) => f.id_fornecedor}
        getItemLabel={(f) => f.razao_social}
      />

      <SearchEntityModal<ProdutoBuscaItem>
        open={buscandoProduto}
        onClose={() => setBuscandoProduto(false)}
        onSelect={(produto) => void adicionarItem(produto)}
        placeholder="Buscar produto por código ou descrição..."
        searchAction={buscarProdutosEntrada}
        excludeIds={itens.map((item) => item.id_produto)}
        getItemId={(p) => p.id_produto}
        getItemLabel={(p) => p.descricao}
      />
    </div>
  );
}
