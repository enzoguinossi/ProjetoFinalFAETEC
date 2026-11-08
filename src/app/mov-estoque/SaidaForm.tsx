"use client";

import { useEffect, useRef, useState } from "react";
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
  getProdutoSaida,
  importarPedidoParaSaida,
  listarDestinatariosSelecao,
  listarPedidosParaImportacao,
  listarProdutosSelecao,
  obterPedidoParaImportacao,
} from "./actions";
import { INPUT_CLASS, LABEL_CLASS } from "./form-ui";
import type {
  DestinatarioSelecaoRow,
  NotaSaidaFormData,
  PedidoImportacaoDetalhe,
  PedidoImportacaoRow,
  ProdutoSaidaDetalhe,
  TipoSaidaPayload,
} from "./tipos";

type Modo = "create" | "view" | "edit";

interface Props {
  mode?: Modo;
  initialData?: NotaSaidaFormData;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
  /** `expedicao.alterar`: habilita a retirada direta de itens na visualização. */
  podeRetirar?: boolean;
  /** Abre o modal de retirada a partir da visualização da nota. */
  onRetirar?: (nota: NotaSaidaFormData) => void;
}

type ItemForm = {
  uid: number;
  /** Item já gravado na nota (`null` = item novo, ainda não salvo). */
  id_item_nota_saida: number | null;
  id_produto: number;
  codigo: string;
  descricao: string;
  /** Unidade de saída do snapshot; null em Avaria/Consumo e notas antigas. */
  unidade_saida: string | null;
  fator_conversao: number;
  /** Quantidade auxiliar; em Remessa é a quantidade na unidade de saída. */
  quantidade: string;
  /** Observação do item (vem do pedido ou da própria nota). */
  observacao: string | null;
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
export default function SaidaForm({ mode = "create", initialData, onSaved, onCancel, podeRetirar, onRetirar }: Props) {
  const mostrarAviso = useAviso();
  const isView = mode === "view";
  const podeEditar = mode === "create" || (mode === "edit" && initialData?.podeEditar === true);

  const [tipo, setTipo] = useState<TipoSaidaPayload>(initialData?.tipo ?? "SAIDA");
  const [destinatario, setDestinatario] = useState<DestinatarioSelecaoRow | null>(
    initialData?.id_destinatario
      ? {
          id_destinatario: initialData.id_destinatario,
          razao_social: initialData.destinatario ?? "",
          tipo_nome: initialData.tipo_nome,
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
      unidade_saida: null,
      fator_conversao: 1,
      quantidade: String(item.quantidade_solicitada),
      observacao: item.observacao,
    })),
  );
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtoPendente, setProdutoPendente] = useState<ProdutoListRow | null>(null);
  const [produtoSaidaDetalhe, setProdutoSaidaDetalhe] =
    useState<ProdutoSaidaDetalhe | null>(null);
  const [quantidadePendente, setQuantidadePendente] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [buscandoDestinatario, setBuscandoDestinatario] = useState(false);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [buscaInicialProduto, setBuscaInicialProduto] = useState("");
  const [sessaoBuscaProduto, setSessaoBuscaProduto] = useState(0);
  /** Última requisição de unidade de saída: evita que uma resposta antiga sobrescreva a nova. */
  const requisicaoProduto = useRef(0);

  const [pedidosImportaveis, setPedidosImportaveis] = useState<PedidoImportacaoRow[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState("");
  const [pedidoPreview, setPedidoPreview] = useState<PedidoImportacaoDetalhe | null>(
    null,
  );
  const [carregandoImportacao, setCarregandoImportacao] = useState(false);

  const ehRemessa = tipo === "SAIDA";

  useEffect(() => {
    if (mode !== "create" || !ehRemessa) return;
    let ativo = true;
    void listarPedidosParaImportacao().then((dados) => {
      if (ativo) setPedidosImportaveis(dados);
    });
    return () => {
      ativo = false;
    };
  }, [mode, ehRemessa]);

  /** Carrega o pedido aprovado para conferência somente leitura. */
  async function carregarPedido(id: number) {
    if (!id) return;
    setCarregandoImportacao(true);
    try {
      const pedido = await obterPedidoParaImportacao(id);
      if (!pedido) {
        mostrarAviso("Pedido indisponível para importação.", "erro");
        return;
      }
      setPedidoPreview(pedido);
    } finally {
      setCarregandoImportacao(false);
    }
  }

  /**
   * Importa o pedido pelo serviço próprio (1 pedido → 1 nota). A nota nasce
   * com o destinatário e os itens do pedido; nada aqui é editável.
   */
  async function importarPedido() {
    if (!pedidoPreview) return;
    setCarregandoImportacao(true);
    try {
      const resultado = await importarPedidoParaSaida(pedidoPreview.id_pedido_escola);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      if (resultado.aviso) mostrarAviso(resultado.aviso, "cautela");
      mostrarAviso(
        `Pedido importado: nota ${formatarCodigo(resultado.id_nota_saida)} criada.`,
        "sucesso",
      );
      setPedidoPreview(null);
      setPedidoSelecionado("");
      setPedidosImportaveis((atuais) =>
        atuais.filter(
          (p) => p.id_pedido_escola !== pedidoPreview.id_pedido_escola,
        ),
      );
      await onSaved();
    } catch {
      mostrarAviso("Não foi possível importar o pedido.", "erro");
    } finally {
      setCarregandoImportacao(false);
    }
  }

  function cancelarImportacao() {
    setPedidoPreview(null);
    setPedidoSelecionado("");
    void listarPedidosParaImportacao().then(setPedidosImportaveis);
  }

  function totalItem(item: ItemForm): number {
    const quantidade = Number(item.quantidade);
    if (item.id_item_nota_saida !== null) return quantidade;
    const fator = ehRemessa ? item.fator_conversao : 1;
    return Number.isFinite(quantidade) && Number.isFinite(fator)
      ? quantidade * fator
      : 0;
  }

  function alterarTipo(valor: TipoSaidaPayload) {
    requisicaoProduto.current += 1;
    setTipo(valor);
    setProdutoPendente(null);
    setProdutoSaidaDetalhe(null);
    if (mode === "create") {
      // A unidade/fator dos itens depende do tipo: recomeça a lista para não
      // reinterpretar uma quantidade de Remessa como outra grandeza.
      setItens([]);
    }
    if (valor !== "SAIDA") {
      // Avaria/Consumo Interno não têm destinatário nem urgência nem unidade de saída.
      setDestinatario(null);
      setUrgente(false);
      setBuscandoDestinatario(false);
      setPedidoSelecionado("");
      setPedidoPreview(null);
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

  async function selecionarProduto(produto: ProdutoListRow) {
    const requisicao = ++requisicaoProduto.current;
    setProdutoPendente(produto);
    setQuantidadePendente("1");
    setProdutoSaidaDetalhe(null);
    if (tipo === "SAIDA") {
      const detalhe = await getProdutoSaida(produto.id_produto);
      if (requisicao !== requisicaoProduto.current) return;
      if (!detalhe) {
        mostrarAviso("Não foi possível carregar a unidade de saída do produto.", "erro");
        setProdutoPendente(null);
        return;
      }
      setProdutoSaidaDetalhe(detalhe);
    }
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

    if (ehRemessa && !produtoSaidaDetalhe) {
      mostrarAviso("Aguarde o carregamento da unidade de saída do produto.", "erro");
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
        unidade_saida: ehRemessa ? (produtoSaidaDetalhe?.unidade_saida ?? null) : null,
        fator_conversao: ehRemessa ? (produtoSaidaDetalhe?.fator ?? 1) : 1,
        quantidade: String(quantidade),
        observacao: null,
      },
    ]);
    setProdutoPendente(null);
    setProdutoSaidaDetalhe(null);
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
        setProdutoSaidaDetalhe(null);
        setQuantidadePendente("1");
        setPedidoSelecionado("");
        void listarPedidosParaImportacao().then(setPedidosImportaveis);
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

  if (mode === "create" && pedidoPreview) {
    return (
      <div className={ui.form}>
        <div className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Importar pedido aprovado</span>
          <p className="m-0 font-sans text-sm text-[#697077]">
            Pedido {formatarCodigo(pedidoPreview.id_pedido_escola)} —{" "}
            {pedidoPreview.escola}. O destinatário e os itens abaixo são do pedido e não
            podem ser alterados: a importação cria uma nota nova vinculada a ele.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={ui.field}>
            <label className={LABEL_CLASS}>Escola</label>
            <input readOnly value={pedidoPreview.escola} className={INPUT_CLASS} />
          </div>
          <div className={ui.field}>
            <label className={LABEL_CLASS}>Observação do pedido</label>
            <input
              readOnly
              value={pedidoPreview.observacao?.trim() || ""}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f2f4f8] text-left">
                <th className="px-3 py-2 font-display font-semibold">Código</th>
                <th className="px-3 py-2 font-display font-semibold">Produto</th>
                <th className="px-3 py-2 text-right font-display font-semibold">
                  Total
                </th>
                <th className="px-3 py-2 font-display font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody>
              {pedidoPreview.itens.map((item) => (
                <tr key={item.id_produto} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs text-[#697077]">
                    {formatarCodigo(item.id_produto)}
                  </td>
                  <td className="px-3 py-2">{item.descricao}</td>
                  <td className="px-3 py-2 text-right">
                    {new Intl.NumberFormat("pt-BR", {
                      maximumFractionDigits: 6,
                    }).format(item.quantidade)}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#697077]">
                    {item.observacao?.trim() || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="m-0 font-sans text-sm text-[#697077]">
          Saldo insuficiente apenas avisa (RN001). Produto em inventário ativo bloqueia a
          importação.
        </p>

        <div className={ui.rowActions}>
          <Button
            label="Cancelar"
            variant="cancel"
            onClick={cancelarImportacao}
            disabled={carregandoImportacao}
          />
          <Button
            label={carregandoImportacao ? "Importando..." : "Importar e criar nota"}
            variant="primary"
            onClick={() => void importarPedido()}
            disabled={carregandoImportacao}
          />
        </div>
      </div>
    );
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

      {mode === "create" && ehRemessa && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className={LABEL_CLASS}>Importar pedido aprovado</span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1 font-sans text-xs text-[#697077]">
              Pedido
              <select
                value={pedidoSelecionado}
                onChange={(e) => setPedidoSelecionado(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Selecione um pedido aprovado</option>
                {pedidosImportaveis.map((pedido) => (
                  <option
                    key={pedido.id_pedido_escola}
                    value={pedido.id_pedido_escola}
                  >
                    {formatarCodigo(pedido.id_pedido_escola)} — {pedido.escola}
                  </option>
                ))}
              </select>
            </label>
            <Button
              label={carregandoImportacao ? "Carregando..." : "Conferir pedido"}
              variant="primary"
              onClick={() => void carregarPedido(Number(pedidoSelecionado))}
              disabled={!pedidoSelecionado || carregandoImportacao}
            />
          </div>
          <span className="font-sans text-xs text-[#697077]">
            A importação cria uma nota nova por pedido, com o destinatário e os itens
            do pedido (somente leitura). O pedido sai desta lista ao gravar.
          </span>
        </div>
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

            <div
              className={`grid items-end gap-3 rounded-lg border border-border p-3 ${
                ehRemessa
                  ? "sm:grid-cols-[1.2fr_1.2fr_0.65fr_0.5fr_0.55fr_0.55fr_auto]"
                  : "sm:grid-cols-[1.3fr_1.5fr_0.7fr_auto]"
              }`}
            >
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
                  placeholder=""
                  className={INPUT_CLASS}
                />
              </div>

              {ehRemessa && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Unidade de saída</span>
                    <input
                      readOnly
                      value={produtoSaidaDetalhe?.unidade_saida ?? ""}
                      placeholder=""
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#697077]">Fator</span>
                    <input
                      readOnly
                      value={produtoSaidaDetalhe?.fator ?? ""}
                      placeholder=""
                      className={INPUT_CLASS}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs text-[#697077]">
                  Quantidade{ehRemessa && produtoSaidaDetalhe?.unidade_saida ? ` (${produtoSaidaDetalhe.unidade_saida})` : ""}
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

              {ehRemessa && (
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs text-[#697077]">Total</span>
                  <input
                    readOnly
                    value={new Intl.NumberFormat("pt-BR", {
                      maximumFractionDigits: 6,
                    }).format(
                      Number(quantidadePendente) * (produtoSaidaDetalhe?.fator ?? 1),
                    )}
                    className={INPUT_CLASS}
                  />
                </div>
              )}

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
          <div className="flex flex-col gap-2">
            {itens.map((item) => {
              const existente = item.id_item_nota_saida !== null;
              const total = totalItem(item);
              const colunas = existente
                ? "sm:grid-cols-[0.8fr_2fr_1fr]"
                : ehRemessa
                  ? "sm:grid-cols-[0.7fr_1.6fr_0.8fr_0.5fr_0.8fr_0.8fr_auto]"
                  : "sm:grid-cols-[0.8fr_2fr_1fr_auto]";
              return (
                <div
                  key={item.uid}
                  className={`grid gap-3 rounded-lg border border-border p-3 font-sans ${colunas}`}
                >
                  <span className="text-sm text-ink-strong">{item.codigo}</span>
                  <span className="flex min-w-0 flex-col gap-0.5 text-sm text-ink-strong">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {item.descricao}
                    </span>
                    {item.observacao?.trim() && (
                      <span className="font-sans text-xs font-normal text-[#697077]">
                        Obs.: {item.observacao}
                      </span>
                    )}
                  </span>

                  {!existente && ehRemessa && (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#697077]">Unidade de saída</span>
                        <span className="text-sm text-ink">{item.unidade_saida ?? ""}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#697077]">Fator</span>
                        <span className="text-sm text-ink">
                          {new Intl.NumberFormat("pt-BR", {
                            maximumFractionDigits: 6,
                          }).format(item.fator_conversao)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#697077]">
                      {existente ? "Total" : "Quantidade"}
                    </span>
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
                  </div>

                  {!existente && ehRemessa && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#697077]">Total</span>
                      <span className="flex h-10 items-center text-sm text-ink-strong">
                        {new Intl.NumberFormat("pt-BR", {
                          maximumFractionDigits: 6,
                        }).format(total)}
                      </span>
                    </div>
                  )}

                  {!existente && (
                    <div className="flex items-end justify-center">
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => removerItem(item.uid)}
                          className="cursor-pointer rounded-md border-none bg-transparent px-2 py-1 font-sans text-sm text-[#b42318] transition-[background-color] duration-100 hover:bg-[rgba(180,35,24,0.08)]"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isView && initialData && initialData.tentativas.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
          <span className={LABEL_CLASS}>Tentativas de entrega</span>
          {initialData.tentativas.map((tentativa) => (
            <div
              key={`${tentativa.id_expedicao}-${tentativa.data ?? ""}`}
              className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center gap-2 font-sans text-sm text-ink">
                <span className="font-semibold">
                  EXP #{tentativa.id_expedicao}
                </span>
                <span className="text-[#697077]">{tentativa.data ?? ""}</span>
                <span className="rounded-full bg-[#f2f4f8] px-2 py-0.5 text-xs font-semibold text-[#4a4f55]">
                  {tentativa.status}
                </span>
                {tentativa.usuario && (
                  <span className="text-xs text-[#697077]">
                    por {tentativa.usuario}
                  </span>
                )}
              </div>
              {tentativa.justificativa && (
                <p className="m-0 font-sans text-sm text-[#8a5a00]">
                  Justificativa: {tentativa.justificativa}
                </p>
              )}
              {tentativa.fotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tentativa.fotos.map((foto) => (
                    <a
                      key={foto.id_anexo}
                      href={foto.url}
                      target="_blank"
                      rel="noreferrer"
                      title={foto.nome_arquivo}
                    >
                      <img
                        src={foto.url}
                        alt={foto.nome_arquivo}
                        width={96}
                        height={96}
                        style={{ width: 96, height: 96 }}
                        className="rounded-lg border border-border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={ui.rowActions}>
        {isView ? (
          <>
            {initialData?.podeRetirar && podeRetirar && onRetirar && (
              <Button
                label="Retirar itens"
                variant="primary"
                onClick={() => onRetirar(initialData)}
              />
            )}
            <Button label="Fechar" variant="cancel" onClick={onCancel} />
          </>
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
