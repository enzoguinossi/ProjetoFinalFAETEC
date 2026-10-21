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
   * Valida a entrada e grava nota, chave de acesso, itens, estoque, movimentações
   * e auditoria em uma única transação (via `notaEntradaDAO.create`).
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

    const nota = await notaEntradaDAO.create(
      {
        id_fornecedor:
          input.id_fornecedor === null || input.id_fornecedor === undefined
            ? null
            : Number(input.id_fornecedor),
        data_recebimento: dataRecebimento,
        observacao: input.observacao?.trim() || null,
        chave_acesso: chaveAcesso,
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
