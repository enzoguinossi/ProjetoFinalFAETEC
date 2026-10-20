import { notaSaidaDAO } from "@/dao/nota-saida";
import type { NotaSaidaRemessaCriacao } from "@/dao/nota-saida";

export type SaidaItemInput = {
  id_produto: number;
  quantidade_solicitada: number;
};

export type SaidaRemessaInput = {
  id_destinatario: number;
  id_funcionario_condutor?: number | null;
  id_veiculo?: number | null;
  urgente?: boolean;
  observacao?: string | null;
  itens: SaidaItemInput[];
};

export type SaidaInput = {
  observacao?: string | null;
  remessas: SaidaRemessaInput[];
};

export type ResultadoSaida =
  | { nota: { id_nota_saida: number }; remessas: { id_remessa: number }[] }
  | { error: string };

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export class NotaSaidaService {
  /**
   * Valida a nota de saída e grava nota, remessas, itens, reservas e auditoria
   * em uma única transação (via `notaSaidaDAO.create`). A reserva usa a
   * `quantidade_solicitada`; saldo insuficiente apenas avisa (RN001), nunca
   * bloqueia.
   */
  async registrar(input: SaidaInput, id_usuario: number): Promise<ResultadoSaida> {
    if (!Array.isArray(input.remessas) || input.remessas.length === 0) {
      return { error: "Informe ao menos uma remessa na nota de saída." };
    }

    const remessas: NotaSaidaRemessaCriacao[] = [];

    for (const remessa of input.remessas) {
      const idDestinatario = idPositivo(remessa.id_destinatario);
      if (!idDestinatario) {
        return { error: "Selecione o destinatário de cada remessa." };
      }

      const idCondutor =
        remessa.id_funcionario_condutor === null || remessa.id_funcionario_condutor === undefined
          ? null
          : idPositivo(remessa.id_funcionario_condutor);
      if (
        remessa.id_funcionario_condutor !== null &&
        remessa.id_funcionario_condutor !== undefined &&
        !idCondutor
      ) {
        return { error: "Condutor inválido na remessa." };
      }

      const idVeiculo =
        remessa.id_veiculo === null || remessa.id_veiculo === undefined
          ? null
          : idPositivo(remessa.id_veiculo);
      if (remessa.id_veiculo !== null && remessa.id_veiculo !== undefined && !idVeiculo) {
        return { error: "Veículo inválido na remessa." };
      }

      if (!Array.isArray(remessa.itens) || remessa.itens.length === 0) {
        return { error: "Informe ao menos um item em cada remessa." };
      }

      const produtos = new Set<number>();
      const itens = [];

      for (const item of remessa.itens) {
        const idProduto = idPositivo(item.id_produto);
        if (!idProduto) {
          return { error: "Produto inválido em uma remessa." };
        }
        if (produtos.has(idProduto)) {
          return { error: "O mesmo produto não pode aparecer mais de uma vez na mesma remessa." };
        }
        produtos.add(idProduto);

        const quantidade = Number(item.quantidade_solicitada);
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          return { error: "A quantidade solicitada deve ser maior que zero." };
        }

        itens.push({ id_produto: idProduto, quantidade_solicitada: quantidade });
      }

      remessas.push({
        id_destinatario: idDestinatario,
        id_funcionario_condutor: idCondutor,
        id_veiculo: idVeiculo,
        urgente: remessa.urgente ?? false,
        observacao: remessa.observacao?.trim() || null,
        itens,
      });
    }

    const resultado = await notaSaidaDAO.create(
      {
        observacao: input.observacao?.trim() || null,
        remessas,
      },
      id_usuario,
    );

    return {
      nota: { id_nota_saida: resultado.nota.id_nota_saida },
      remessas: resultado.remessas.map((r) => ({ id_remessa: r.id_remessa })),
    };
  }
}

export const notaSaidaService = new NotaSaidaService();
