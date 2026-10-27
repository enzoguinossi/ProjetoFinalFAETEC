"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import Switch from "@/components/Switch";
import {
  abrirInventario,
  editarInventario,
  listarProdutosSelecao,
  type InventarioDetalhe,
  type InventarioProdutoSelecao,
} from "./actions";

type Props = {
  mode: "create" | "edit";
  inicial?: InventarioDetalhe;
  onSaved: (id?: number) => void;
  onCancel: () => void;
};

export default function InventarioForm({ mode, inicial, onSaved, onCancel }: Props) {
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [contagemCega, setContagemCega] = useState(inicial?.contagem_cega ?? true);
  const [todos, setTodos] = useState(false);
  const [produtos, setProdutos] = useState<InventarioProdutoSelecao[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(
    new Set(inicial?.itens.map((item) => item.id_produto) ?? []),
  );
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const resultado = await listarProdutosSelecao("");
      if (!ativo) return;
      if (Array.isArray(resultado)) {
        setProdutos(resultado);
      } else {
        setErro(resultado.error);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const produtosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (produto) =>
        produto.descricao.toLowerCase().includes(termo) ||
        produto.codigo.includes(termo),
    );
  }, [busca, produtos]);

  function alternarProduto(id: number) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function salvar() {
    setErro("");
    if (!observacao.trim()) {
      setErro("Informe a observação (nome do inventário).");
      return;
    }
    if (!todos && selecionados.size === 0) {
      setErro("Selecione pelo menos um produto ou marque todos.");
      return;
    }

    setSalvando(true);
    try {
      const input = {
        observacao: observacao.trim(),
        contagem_cega: contagemCega,
        todos,
        id_produtos: todos ? [] : [...selecionados],
      };
      const resultado =
        mode === "create"
          ? await abrirInventario(input)
          : await editarInventario(inicial!.id_inventario, input);
      if ("error" in resultado && resultado.error) {
        setErro(resultado.error);
        return;
      }
      const id =
        "id" in resultado && typeof resultado.id === "number"
          ? resultado.id
          : inicial?.id_inventario;
      onSaved(id);
    } catch {
      setErro("Não foi possível salvar o inventário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5" data-figma="InventarioForm">
      <div className="flex flex-col gap-1">
        <label htmlFor="inventario-observacao" className="text-sm font-semibold text-ink">
          Observação (nome do inventário)
        </label>
        <input
          id="inventario-observacao"
          value={observacao}
          onChange={(event) => setObservacao(event.target.value)}
          placeholder="Ex.: Contagem mensal do galpão"
          className="h-10 rounded-lg border border-[#c1c7cd] bg-white px-3 font-sans text-sm text-ink outline-none focus:border-brand"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-[#f8fafb] px-3 py-2">
        <div>
          <p className="m-0 text-sm font-semibold text-ink">Contagem cega</p>
          <p className="m-0 text-xs text-[#697077]">
            Ligado: só quem tem <code>estoque.ver_saldo</code> vê o sistema. Desligado: todos veem.
          </p>
        </div>
        <Switch
          checked={contagemCega}
          onChange={setContagemCega}
          label="Contagem cega"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={todos}
              onChange={(event) => setTodos(event.target.checked)}
            />
            Incluir todos os produtos ativos
          </label>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Filtrar produto..."
            className="h-9 w-full rounded-lg border border-[#c1c7cd] px-3 font-sans text-sm sm:w-64"
          />
        </div>

        <div className="max-h-72 overflow-auto rounded-lg border border-border">
          {carregando ? (
            <p className="p-4 text-sm text-[#697077]">Carregando produtos...</p>
          ) : produtosVisiveis.length === 0 ? (
            <p className="p-4 text-sm text-[#697077]">Nenhum produto ativo encontrado.</p>
          ) : (
            produtosVisiveis.map((produto) => (
              <label
                key={produto.id_produto}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-[#f8fafb]"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={todos || selecionados.has(produto.id_produto)}
                    disabled={todos}
                    onChange={() => alternarProduto(produto.id_produto)}
                  />
                  <span className="font-mono text-xs text-[#697077]">{produto.codigo}</span>
                  <span>{produto.descricao}</span>
                </span>
                {produto.saldo !== undefined && (
                  <span className="text-xs text-[#697077]">saldo {produto.saldo}</span>
                )}
              </label>
            ))
          )}
        </div>
        {!todos && (
          <p className="m-0 text-xs text-[#697077]">
            {selecionados.size} produto(s) selecionado(s)
          </p>
        )}
      </div>

      {erro && (
        <p role="alert" className="m-0 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-[#8a1c1c]">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button label="Cancelar" variant="cancel" onClick={onCancel} disabled={salvando} />
        <Button
          label={mode === "create" ? "Abrir inventário" : "Salvar alterações"}
          onClick={salvar}
          disabled={salvando || carregando}
        />
      </div>
    </div>
  );
}
