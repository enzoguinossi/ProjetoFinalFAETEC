import { estoqueDAO } from "@/dao";

export class EstoqueService {
  /**
   * RN001 — Alerta de saldo insuficiente (não bloqueia)
   */
  async verificarDisponibilidade(id_produto: number, quantidade: number) {
    const saldo = await estoqueDAO.getSaldoDisponivel(id_produto);
    return {
      suficiente: saldo.saldo_disponivel >= quantidade,
      saldo_disponivel: saldo.saldo_disponivel,
      deficit: Math.max(0, quantidade - saldo.saldo_disponivel),
    };
  }
}

export const estoqueService = new EstoqueService();