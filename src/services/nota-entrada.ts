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
  chaves_acesso?: string[];
  itens: EntradaItemInput[];
};

export type ResultadoEntrada =
  | { nota: { id_nota_entrada: number } }
  | { error: string };

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

export class NotaEntradaService {
  /**
   * Valida a entrada e grava nota, chaves, itens, estoque, movimentações e
   * auditoria em uma única transação (via `notaEntradaDAO.create`).
   */
  async registrar(input: EntradaInput, id_usuario: number): Promise<ResultadoEntrada> {
    if (!Array.isArray(input.itens) || input.itens.length === 0) {
      return { error: "Informe ao menos um item na nota de entrada." };
    }

    const produtos = new Set<number>();
    for (const item of input.itens) {
      const id = Number(item.id_produto);
      const fator = Number(item.fator_conversao);
      const quantidade = Number(item.quantidade);

      if (!Number.isInteger(id) || id <= 0) {
        return { error: "Produto inválido na nota de entrada." };
      }
      if (produtos.has(id)) {
        return { error: "O mesmo produto não pode aparecer mais de uma vez na nota." };
      }
      produtos.add(id);

      if (!Number.isFinite(fator) || fator <= 0) {
        return { error: "O fator de conversão deve ser maior que zero." };
      }
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return { error: "A quantidade deve ser maior que zero." };
      }
    }

    if (input.id_fornecedor !== null && input.id_fornecedor !== undefined) {
      const idFornecedor = Number(input.id_fornecedor);
      if (!Number.isInteger(idFornecedor) || idFornecedor <= 0) {
        return { error: "Fornecedor inválido." };
      }
    }

    // Uma nota de entrada tem no máximo uma chave de acesso. A tabela
    // `nota_entrada_chave_acesso` continua existindo (1:N no schema); o limite
    // de uma chave é regra de aplicação, não do modelo físico.
    const chaves: string[] = [];
    for (const bruta of input.chaves_acesso ?? []) {
      const chave = String(bruta ?? "").trim();
      if (!chave) continue;
      if (chave.length !== 44) {
        return { error: "A chave de acesso da NF-e deve ter 44 caracteres." };
      }
      chaves.push(chave);
    }
    if (chaves.length > 1) {
      return { error: "A nota de entrada aceita apenas uma chave de acesso da NF-e." };
    }

    const dataRecebimento = lerDataRecebimento(input.data_recebimento);
    if (dataRecebimento && "error" in dataRecebimento) return dataRecebimento;

    const nota = await notaEntradaDAO.create(
      {
        id_fornecedor:
          input.id_fornecedor === null || input.id_fornecedor === undefined
            ? null
            : Number(input.id_fornecedor),
        data_recebimento: dataRecebimento,
        observacao: input.observacao?.trim() || null,
        chaves_acesso: chaves,
        itens: input.itens.map((item) => {
          const fator_conversao = Number(item.fator_conversao);
          const quantidade = Number(item.quantidade);
          return {
            id_produto: Number(item.id_produto),
            fator_conversao,
            quantidade,
            quantidade_convertida: quantidade * fator_conversao,
            observacao: item.observacao?.trim() || null,
          };
        }),
      },
      id_usuario,
    );

    return { nota };
  }
}

export const notaEntradaService = new NotaEntradaService();
