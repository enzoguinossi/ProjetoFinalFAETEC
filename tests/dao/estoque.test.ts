import { describe, expect, it } from "vitest";
import { saldoDAO } from "@/dao/estoque";
import { criarEstoque, criarProduto, criarUsuario } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

describe("saldoDAO", () => {
  describe("getSaldoDisponivel", () => {
    it("soma saldo e reserva do produto", async () => {
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 10, saldoReservado: 3 });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 5, saldoReservado: 2 });

      const saldo = await saldoDAO.getSaldoDisponivel(produto.id_produto);

      expect(saldo).toEqual({
        saldo: 15,
        saldo_reservado: 5,
        saldo_disponivel: 10,
      });
    });
  });

  describe("produto consolidado (backfill)", () => {
    it("mantém saldo somado, reserva e movimentações ligadas ao produto", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto({ descricao: "Consolidado" });
      await prismaTeste.produto.update({
        where: { id_produto: produto.id_produto },
        data: { saldo: 15, saldo_reservado: 5 },
      });
      await prismaTeste.movimentacaoEstoque.create({
        data: {
          id_produto: produto.id_produto,
          id_usuario: usuario.id_usuario,
          quantidade: 15,
          saldo_anterior: 0,
          saldo_posterior: 15,
          data_hora: new Date(),
        },
      });

      const saldo = await saldoDAO.getSaldoDisponivel(produto.id_produto);
      expect(saldo).toEqual({ saldo: 15, saldo_reservado: 5, saldo_disponivel: 10 });

      const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
        where: { id_produto: produto.id_produto },
      });
      expect(movimentacao.id_produto).toBe(produto.id_produto);

      const semLinha = await criarProduto({ descricao: "Sem histórico" });
      const produtoSemLinha = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: semLinha.id_produto },
      });
      expect(produtoSemLinha.saldo).toBe(0);
      expect(produtoSemLinha.saldo_reservado).toBe(0);
    });
  });

  describe("movimentar", () => {
    it("incrementa o estoque e registra a movimentação com saldos", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });

      await saldoDAO.movimentar(estoque.id_produto, usuario.id_usuario, 5, "Entrada teste");

      const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: estoque.id_produto },
      });
      expect(estoqueApos.saldo).toBe(15);

      const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
        where: { id_produto: estoque.id_produto },
      });
      expect(movimentacoes).toHaveLength(1);
      expect(movimentacoes[0]).toMatchObject({
        id_usuario: usuario.id_usuario,
        quantidade: 5,
        saldo_anterior: 10,
        saldo_posterior: 15,
        observacao: "Entrada teste",
      });
    });

    it("aceita quantidade negativa (baixa)", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });

      await saldoDAO.movimentar(estoque.id_produto, usuario.id_usuario, -4);

      const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: estoque.id_produto },
      });
      expect(estoqueApos.saldo).toBe(6);
    });
  });
});
