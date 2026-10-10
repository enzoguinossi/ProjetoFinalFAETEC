import { describe, expect, it } from "vitest";
import { estoqueDAO } from "@/dao/estoque";
import { criarEstoque, criarProduto, criarUsuario } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

describe("estoqueDAO", () => {
  describe("list", () => {
    it("pagina, filtra por produto e ignora estoques inativos", async () => {
      const produtoA = await criarProduto();
      const produtoB = await criarProduto();
      await criarEstoque(produtoA.id_produto, { quantidadeAtual: 10 });
      await criarEstoque(produtoA.id_produto, { quantidadeAtual: 5, ativo: false });
      await criarEstoque(produtoB.id_produto, { quantidadeAtual: 7 });

      const doA = await estoqueDAO.list({ id_produto: produtoA.id_produto });
      expect(doA.total).toBe(1);
      expect(doA.data[0]?.quantidade_atual).toBe(10);

      const todos = await estoqueDAO.list({ page: 1, limit: 2 });
      expect(todos.total).toBe(2);
      expect(todos.totalPages).toBe(1);
      expect(todos.data[0]?.produto.descricao).toBeDefined();
    });
  });

  describe("getSaldoDisponivel", () => {
    it("soma quantidade e reserva dos estoques ativos", async () => {
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 10, saldoReservado: 3 });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 5, saldoReservado: 2 });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 100, ativo: false });

      const saldo = await estoqueDAO.getSaldoDisponivel(produto.id_produto);

      expect(saldo).toEqual({
        quantidade_atual: 15,
        saldo_reservado: 5,
        saldo_disponivel: 10,
      });
    });
  });

  describe("movimentar", () => {
    it("incrementa o estoque e registra a movimentação com saldos", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });

      await estoqueDAO.movimentar(estoque.id_estoque, usuario.id_usuario, 5, "Entrada teste");

      const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
      });
      expect(estoqueApos.quantidade_atual).toBe(15);

      const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
        where: { id_estoque: estoque.id_estoque },
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

      await estoqueDAO.movimentar(estoque.id_estoque, usuario.id_usuario, -4);

      const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
      });
      expect(estoqueApos.quantidade_atual).toBe(6);
    });
  });
});
