import { describe, expect, it } from "vitest";
import { estoqueService } from "@/services/estoque";
import { criarEstoque, criarProduto } from "../helpers/factories";

describe("estoqueService.verificarDisponibilidade", () => {
  it("retorna suficiente quando o saldo disponível cobre a quantidade", async () => {
    const produto = await criarProduto();
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10, saldoReservado: 2 });

    const resultado = await estoqueService.verificarDisponibilidade(produto.id_produto, 8);

    expect(resultado).toEqual({ suficiente: true, saldo_disponivel: 8, deficit: 0 });
  });

  it("retorna déficit quando o saldo é insuficiente (sem bloquear)", async () => {
    const produto = await criarProduto();
    await criarEstoque(produto.id_produto, { quantidadeAtual: 5, saldoReservado: 1 });

    const resultado = await estoqueService.verificarDisponibilidade(produto.id_produto, 10);

    expect(resultado).toEqual({ suficiente: false, saldo_disponivel: 4, deficit: 6 });
  });

  it("considera saldo zero quando não há estoque", async () => {
    const produto = await criarProduto();

    const resultado = await estoqueService.verificarDisponibilidade(produto.id_produto, 1);

    expect(resultado).toEqual({ suficiente: false, saldo_disponivel: 0, deficit: 1 });
  });
});
