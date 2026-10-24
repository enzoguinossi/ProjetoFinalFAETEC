import { notaEntradaDAO } from "@/dao/nota-entrada";

export type EntradaItemInput = {
  id_produto: number;
  fator_conversao: number;
  quantidade: number;
  observacao?: string | null;
};

export type EntradaInput = {
  id_fornecedor?: number | null;
  /** Data no formato `YYYY-MM-DD` ou um Date. */
  data_recebimento?: string | Date | null;
  observacao?: string | null;
  chave_acesso?: string | null;
  itens: EntradaItemInput[];
};

/** Item da edição: `id_item_nota_entrada` presente = item existente; ausente = novo. */
export type EntradaItemAtualizacaoInput = EntradaItemInput & {
  id_item_nota_entrada?: number | null;
};

export type AtualizacaoEntradaInput = Omit<EntradaInput, "itens"> & {
  itens: EntradaItemAtualizacaoInput[];
};

export type ResultadoEntrada =
  | { nota: { id_nota_entrada: number } }
  | { error: string };

type ItemValidado = {
  id_item_nota_entrada: number | null;
  id_produto: number;
  fator_conversao: number;
  quantidade: number;
  quantidade_convertida: number;
  observacao: string | null;
};

function lerDataRecebimento(valor: EntradaInput["data_recebimento"]): Date | null | { error: string } {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? { error: "Data de recebimento inválida." } : valor;
  }

  const texto = valor.trim();
  if (!texto) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return { error: "Data de recebimento inválida." };
  }
  const data = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return { error: "Data de recebimento inválida." };
  return data;
}

/**
 * Valida os números/itens e normaliza o payload. A repetição de produto é
 * conferida à parte (`validarProdutosUnicos`) porque, na edição, o produto de
 * um item existente é sempre o gravado na nota.
 */
function validarItens(
  itens: EntradaItemAtualizacaoInput[],
): { itens: ItemValidado[] } | { error: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { error: "Informe ao menos um item na nota de entrada." };
  }

  const validados: ItemValidado[] = [];
  for (const item of itens) {
    const id = Number(item.id_produto);
    const fator = Number(item.fator_conversao);
    const quantidade = Number(item.quantidade);

    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Produto inválido na nota de entrada." };
    }

    const idItem =
      item.id_item_nota_entrada === null || item.id_item_nota_entrada === undefined
        ? null
        : Number(item.id_item_nota_entrada);
    if (idItem !== null && (!Number.isInteger(idItem) || idItem <= 0)) {
      return { error: "Item inválido na nota de entrada." };
    }

    if (!Number.isFinite(fator) || fator <= 0) {
      return { error: "O fator de conversão deve ser maior que zero." };
    }
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: "A quantidade deve ser maior que zero." };
    }

    validados.push({
      id_item_nota_entrada: idItem,
      id_produto: id,
      fator_conversao: fator,
      quantidade,
      quantidade_convertida: quantidade * fator,
      observacao: item.observacao?.trim() || null,
    });
  }

  return { itens: validados };
}

function validarProdutosUnicos(itens: { id_produto: number }[]): string | null {
  const produtos = new Set<number>();
  for (const item of itens) {
    if (produtos.has(item.id_produto)) {
      return "O mesmo produto não pode aparecer mais de uma vez na nota.";
    }
    produtos.add(item.id_produto);
  }
  return null;
}

function validarCabecalho(
  input: Omit<EntradaInput, "itens">,
):
  | {
      id_fornecedor: number | null;
      data_recebimento: Date | null;
      observacao: string | null;
      chave_acesso: string | null;
    }
  | { error: string } {
  if (input.id_fornecedor !== null && input.id_fornecedor !== undefined) {
    const idFornecedor = Number(input.id_fornecedor);
    if (!Number.isInteger(idFornecedor) || idFornecedor <= 0) {
      return { error: "Fornecedor inválido." };
    }
  }

  // Chave de acesso da NF-e: opcional; quando informada, precisa ter 44
  // caracteres. A nota tem no máximo uma chave — o schema garante isso
  // (`nota_entrada.chave_acesso` é coluna única).
  let chaveAcesso: string | null = null;
  const chaveBruta = String(input.chave_acesso ?? "").trim();
  if (chaveBruta) {
    if (chaveBruta.length !== 44) {
      return { error: "A chave de acesso da NF-e deve ter 44 caracteres." };
    }
    chaveAcesso = chaveBruta;
  }

  const dataRecebimento = lerDataRecebimento(input.data_recebimento);
  if (dataRecebimento && "error" in dataRecebimento) return dataRecebimento;

  return {
    id_fornecedor:
      input.id_fornecedor === null || input.id_fornecedor === undefined
        ? null
        : Number(input.id_fornecedor),
    data_recebimento: dataRecebimento,
    observacao: input.observacao?.trim() || null,
    chave_acesso: chaveAcesso,
  };
}

export class NotaEntradaService {
  /**
   * Valida a entrada e grava nota, chave de acesso, itens, estoque, movimentações
   * e auditoria em uma única transação (via `notaEntradaDAO.create`).
   */
  async registrar(input: EntradaInput, id_usuario: number): Promise<ResultadoEntrada> {
    const itens = validarItens(input.itens);
    if ("error" in itens) return itens;

    const repetido = validarProdutosUnicos(itens.itens);
    if (repetido) return { error: repetido };

    const cabecalho = validarCabecalho(input);
    if ("error" in cabecalho) return cabecalho;

    const nota = await notaEntradaDAO.create(
      {
        ...cabecalho,
        itens: itens.itens.map((item) => ({
          id_produto: item.id_produto,
          fator_conversao: item.fator_conversao,
          quantidade: item.quantidade,
          quantidade_convertida: item.quantidade_convertida,
          observacao: item.observacao,
        })),
      },
      id_usuario,
    );

    return { nota };
  }

  /**
   * Valida e aplica a edição de uma nota de entrada. Itens existentes só podem
   * ter fator/quantidade alterados; acrescentar itens é permitido; remover é
   * recusado (RN004). A correção de estoque e a auditoria ficam no DAO, na
   * mesma transação.
   */
  async atualizar(
    id: number,
    input: AtualizacaoEntradaInput,
    id_usuario: number,
  ): Promise<ResultadoEntrada> {
    const idNota = Number(id);
    if (!Number.isInteger(idNota) || idNota <= 0) {
      return { error: "Nota de entrada inválida." };
    }

    const itens = validarItens(input.itens);
    if ("error" in itens) return itens;

    const cabecalho = validarCabecalho(input);
    if ("error" in cabecalho) return cabecalho;

    const existente = await notaEntradaDAO.getById(idNota);
    if (!existente) return { error: "Nota de entrada não encontrada." };

    const itensExistentes = new Map(
      existente.itens.map((item) => [item.id_item_nota_entrada, item]),
    );
    const idsInformados = new Set<number>();
    for (const item of itens.itens) {
      if (item.id_item_nota_entrada === null) continue;
      if (!itensExistentes.has(item.id_item_nota_entrada)) {
        return { error: "Item inválido para esta nota de entrada." };
      }
      idsInformados.add(item.id_item_nota_entrada);
    }
    for (const idAtual of itensExistentes.keys()) {
      if (!idsInformados.has(idAtual)) {
        return { error: "Não é possível remover itens de uma nota de entrada." };
      }
    }

    // O produto de um item existente é o gravado na nota: a edição altera
    // apenas fator/quantidade (e a observação), nunca o produto.
    const normalizados = itens.itens.map((item) => {
      if (item.id_item_nota_entrada === null) return item;
      const atual = itensExistentes.get(item.id_item_nota_entrada)!;
      return { ...item, id_produto: atual.id_produto };
    });

    const repetido = validarProdutosUnicos(normalizados);
    if (repetido) return { error: repetido };

    const nota = await notaEntradaDAO.update(
      idNota,
      { ...cabecalho, itens: normalizados },
      id_usuario,
    );

    return { nota };
  }
}

export const notaEntradaService = new NotaEntradaService();
