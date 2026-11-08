import type { StatusPedido } from "@prisma/client";
import { destinatarioDAO } from "@/dao/destinatario";
import { pedidoDAO, type PedidoFiltros } from "@/dao/pedido";
import { produtoDAO } from "@/dao/produto";
import { mensagemDeErro } from "@/dao/_errors";
import { notaSaidaService } from "@/services/nota-saida";
import type { TabelaPlanilha } from "@/lib/planilha";
import {
  formatarDataRelatorio,
  formatarQuantidadeCsv,
  montarCsv,
} from "@/services/relatorio";

export const ROTULOS_STATUS_PEDIDO: Record<StatusPedido, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Aprovado",
  RECUSADO: "Recusado",
};

/** Item digitado na solicitação: quantidade total (sem unidade/fator). */
export type PedidoItemInput = {
  id_produto: number;
  quantidade: number;
  observacao?: string | null;
};

export type PedidoInput = {
  id_destinatario: number;
  observacao?: string | null;
  itens: PedidoItemInput[];
};

export type ResultadoPedido =
  | { pedido: { id_pedido_escola: number } }
  | { error: string };

export type ResultadoImportacaoPedido =
  | {
      nota: { id_nota_saida: number };
      pedido: { id_pedido_escola: number };
      aviso: string | null;
    }
  | { error: string };

export type PedidoRelatorioRow = {
  id_pedido_escola: number;
  id_destinatario: number;
  codigo: string;
  data: string;
  escola: string;
  status: string;
  itens: { descricao: string; quantidade: number }[];
  total: number;
  nota: number | null;
};

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Valida e normaliza os itens do pedido: produto repetido **soma** a
 * quantidade (o pedido guarda um item por produto, sempre com o total).
 */
export function normalizarItens(
  itens: PedidoItemInput[],
): { itens: PedidoItemInput[] } | { error: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { error: "Informe ao menos um item no pedido." };
  }

  const porProduto = new Map<number, PedidoItemInput>();
  for (const item of itens) {
    const idProduto = idPositivo(item.id_produto);
    if (!idProduto) return { error: "Produto inválido em um item do pedido." };

    const quantidade = Number(item.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: "A quantidade de cada item deve ser maior que zero." };
    }

    const atual = porProduto.get(idProduto);
    if (atual) {
      atual.quantidade += quantidade;
      if (!atual.observacao && item.observacao) atual.observacao = item.observacao;
    } else {
      porProduto.set(idProduto, {
        id_produto: idProduto,
        quantidade,
        observacao: item.observacao ?? null,
      });
    }
  }

  return { itens: [...porProduto.values()] };
}

/** Destinatário e produtos precisam existir e estar ativos. */
async function validarReferencias(
  data: PedidoInput,
): Promise<{ error: string } | null> {
  const idDestinatario = idPositivo(data.id_destinatario);
  if (!idDestinatario) return { error: "Selecione a escola do pedido." };

  const destinatario = await destinatarioDAO.getById(idDestinatario);
  if (!destinatario) return { error: "Escola não encontrada." };
  if (destinatario.ativo === false) {
    return { error: "A escola selecionada está desativada." };
  }

  for (const item of data.itens) {
    const produto = await produtoDAO.getById(item.id_produto);
    if (!produto) return { error: "Produto não encontrado em um item do pedido." };
    if (produto.ativo === false) {
      return { error: `O produto ${produto.descricao} está desativado.` };
    }
  }

  return null;
}

function payloadCriacao(data: PedidoInput) {
  return {
    id_destinatario: Number(data.id_destinatario),
    observacao: data.observacao?.trim() || null,
    itens: data.itens.map((item) => ({
      id_produto: item.id_produto,
      quantidade: item.quantidade,
      observacao: item.observacao?.trim() || null,
    })),
  };
}

export class PedidoService {
  /** Lista paginada; filtros e busca são aplicados no banco. */
  async listar(filtros: PedidoFiltros = {}) {
    return pedidoDAO.list(filtros);
  }

  async detalhar(id: number) {
    const idPedido = idPositivo(id);
    if (!idPedido) return null;
    return pedidoDAO.getById(idPedido);
  }

  /** Pedidos aprovados sem nota, disponíveis para a importação na Saída. */
  async listarParaImportacao() {
    return pedidoDAO.listarAprovadosSemNota();
  }

  /**
   * Cria a solicitação (`PENDENTE`). O pedido é só a solicitação: não reserva
   * estoque e não se vincula a nenhuma nota até a importação.
   */
  async criar(data: PedidoInput, id_usuario: number): Promise<ResultadoPedido> {
    const itens = normalizarItens(data.itens ?? []);
    if ("error" in itens) return itens;

    const normalizado: PedidoInput = { ...data, itens: itens.itens };
    const erro = await validarReferencias(normalizado);
    if (erro) return erro;

    try {
      const pedido = await pedidoDAO.create(payloadCriacao(normalizado), id_usuario);
      return { pedido: { id_pedido_escola: pedido.id_pedido_escola } };
    } catch {
      return { error: "Não foi possível criar o pedido." };
    }
  }

  /** Edita um pedido pendente (destinatário, observação e itens). */
  async atualizar(
    id: number,
    data: PedidoInput,
    id_usuario: number,
  ): Promise<ResultadoPedido> {
    const idPedido = idPositivo(id);
    if (!idPedido) return { error: "Pedido inválido." };

    const itens = normalizarItens(data.itens ?? []);
    if ("error" in itens) return itens;

    const normalizado: PedidoInput = { ...data, itens: itens.itens };
    const erro = await validarReferencias(normalizado);
    if (erro) return erro;

    try {
      const resultado = await pedidoDAO.update(
        idPedido,
        payloadCriacao(normalizado),
        id_usuario,
      );
      if ("error" in resultado) return resultado;
      return { pedido: { id_pedido_escola: resultado.pedido.id_pedido_escola } };
    } catch {
      return { error: "Não foi possível editar o pedido." };
    }
  }

  /** Aprova o pedido: fica disponível para importação na Saída. */
  async aprovar(id: number, id_usuario: number): Promise<ResultadoPedido> {
    return this.alterarStatus(id, "CONFIRMADO", id_usuario);
  }

  /** Recusa o pedido: permanece no histórico, sem nota. */
  async recusar(id: number, id_usuario: number): Promise<ResultadoPedido> {
    return this.alterarStatus(id, "RECUSADO", id_usuario);
  }

  private async alterarStatus(
    id: number,
    status: StatusPedido,
    id_usuario: number,
  ): Promise<ResultadoPedido> {
    const idPedido = idPositivo(id);
    if (!idPedido) return { error: "Pedido inválido." };

    try {
      const resultado = await pedidoDAO.alterarStatus(idPedido, status, id_usuario);
      if ("error" in resultado) return resultado;
      return { pedido: { id_pedido_escola: resultado.pedido.id_pedido_escola } };
    } catch {
      return { error: "Não foi possível analisar o pedido." };
    }
  }

  /**
   * Importa o pedido aprovado na Saída: cria **uma nota nova** (`SAIDA`) com o
   * destinatário e os totais dos itens do pedido, sem reconverter unidade.
   * A nota, a reserva/baixa, a auditoria e o vínculo `pedido.ID_nota_saida`
   * acontecem na mesma transação (`notaSaidaDAO.create`), então o pedido sai da
   * lista de importação assim que a nota é criada.
   */
  async importar(
    id: number,
    id_usuario: number,
  ): Promise<ResultadoImportacaoPedido> {
    const idPedido = idPositivo(id);
    if (!idPedido) return { error: "Pedido inválido." };

    const pedido = await pedidoDAO.getById(idPedido);
    if (!pedido) return { error: "Pedido não encontrado." };
    if (pedido.status !== "CONFIRMADO") {
      return { error: "Só pedidos aprovados podem ser importados na saída." };
    }
    if (pedido.id_nota_saida !== null) {
      return { error: "Este pedido já possui nota de saída." };
    }
    if (pedido.itens.length === 0) {
      return { error: "O pedido não possui itens para importar." };
    }

    // Defesa para dados antigos: soma produtos repetidos antes de criar a nota.
    const somados = normalizarItens(
      pedido.itens.map((item) => ({
        id_produto: item.id_produto,
        quantidade: Number(item.quantidade),
        observacao: item.observacao,
      })),
    );
    if ("error" in somados) return somados;

    const resultado = await notaSaidaService
      .registrar(
        {
          tipo: "SAIDA",
          id_destinatario: pedido.id_destinatario,
          observacao: pedido.observacao,
          itens: somados.itens.map((item) => ({
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade,
            total_base: true,
            observacao: item.observacao ?? null,
          })),
          id_pedido_escola: pedido.id_pedido_escola,
        },
        id_usuario,
      )
      .catch((e: unknown) => ({
        error: mensagemDeErro(e, "Não foi possível importar o pedido na saída."),
      }));

    if ("error" in resultado) return resultado;

    return {
      nota: { id_nota_saida: resultado.nota.id_nota_saida },
      pedido: { id_pedido_escola: pedido.id_pedido_escola },
      aviso: resultado.aviso,
    };
  }

  /** Linhas do relatório "Pedidos por escola" (uma linha por pedido). */
  async relatorio(filtros: PedidoFiltros = {}): Promise<PedidoRelatorioRow[]> {
    const pedidos = await pedidoDAO.listarTodos(filtros);
    return pedidos.map((pedido) => {
      const itens = pedido.itens.map((item) => ({
        descricao: item.produto.descricao,
        quantidade: Number(item.quantidade),
      }));
      return {
        id_pedido_escola: pedido.id_pedido_escola,
        id_destinatario: pedido.destinatario.id_destinatario,
        codigo: String(pedido.id_pedido_escola).padStart(6, "0"),
        data: formatarDataRelatorio(pedido.data_criacao),
        escola: pedido.destinatario.pessoaJuridica.razao_social,
        status: ROTULOS_STATUS_PEDIDO[pedido.status] ?? pedido.status,
        itens,
        total: itens.reduce((soma, item) => soma + item.quantidade, 0),
        nota: pedido.id_nota_saida,
      };
    });
  }
}

/** Tabela do relatório de pedidos: mesmas colunas do CSV, total numérico. */
export function tabelaPedidos(linhas: PedidoRelatorioRow[]): TabelaPlanilha {
  return {
    cabecalho: [
      "Pedido",
      "Data",
      "Escola",
      "Status",
      "Itens",
      "Total",
      "Nota de saída",
    ],
    registros: linhas.map((linha) => [
      linha.codigo,
      linha.data,
      linha.escola,
      linha.status,
      linha.itens
        .map((item) => `${item.descricao} (${formatarQuantidadeCsv(item.quantidade)})`)
        .join(" | "),
      linha.total,
      linha.nota,
    ]),
  };
}

/** CSV do relatório de pedidos: BOM UTF-8, separador `;` e decimal com vírgula. */
export function gerarCsvPedidos(linhas: PedidoRelatorioRow[]): string {
  return montarCsv(tabelaPedidos(linhas));
}

export const pedidoService = new PedidoService();
