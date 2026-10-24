import { describe, expect, it } from "vitest";
import { relatorioDAO } from "@/dao/relatorio";
import {
  criarEstoque,
  criarMovimentacao,
  criarDestinatario,
  criarFornecedor,
  criarNotaEntrada,
  criarNotaSaida,
  criarProduto,
  criarUsuario,
  criarConversao,
} from "../helpers/factories";

describe("relatorioDAO", () => {
  describe("listarProdutosRelatorio", () => {
    it("lista ativas por padrão, ordena por descrição e soma os estoques ativos", async () => {
      const caixa = await criarConversao("CX");
      const arroz = await criarProduto({
        descricao: "Arroz",
        idConversaoPadrao: caixa.id_conversao,
      });
      const feijao = await criarProduto({ descricao: "Feijão" });
      await criarProduto({ descricao: "Açúcar", ativo: false });

      await criarEstoque(arroz.id_produto, { quantidadeAtual: 10, saldoReservado: 3 });
      await criarEstoque(arroz.id_produto, { quantidadeAtual: 5, saldoReservado: 2 });
      await criarEstoque(arroz.id_produto, { quantidadeAtual: 99, ativo: false });
      await criarEstoque(feijao.id_produto, { quantidadeAtual: 2.5 });

      const { data, totais } = await relatorioDAO.listarProdutosRelatorio();

      expect(data.map((p) => p.descricao)).toEqual(["Arroz", "Feijão"]);
      expect(data[0]).toMatchObject({
        id_produto: arroz.id_produto,
        codigo: String(arroz.id_produto).padStart(6, "0"),
        unidade: "CX",
        quantidade: 15,
        livre: 10,
        situacao: "Ativo",
      });
      expect(data[1]).toMatchObject({
        unidade: "UNIDADE",
        quantidade: 2.5,
        livre: 2.5,
      });
      expect(totais).toEqual({ quantidade: 17.5, livre: 12.5 });
    });

    it("filtra por situação inativas e todas", async () => {
      await criarProduto({ descricao: "Ativo" });
      await criarProduto({ descricao: "Inativo", ativo: false });

      const inativas = await relatorioDAO.listarProdutosRelatorio({ situacao: "inativas" });
      expect(inativas.data.map((p) => p.descricao)).toEqual(["Inativo"]);
      expect(inativas.data[0]?.situacao).toBe("Inativo");

      const todas = await relatorioDAO.listarProdutosRelatorio({ situacao: "todas" });
      expect(todas.data.map((p) => p.descricao)).toEqual(["Ativo", "Inativo"]);
    });

    it("devolve listas vazias e totais zerados sem produtos", async () => {
      const resultado = await relatorioDAO.listarProdutosRelatorio();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ quantidade: 0, livre: 0 });
    });
  });

  describe("listarMovimentacoes", () => {
    it("filtra o período inclusivo, ordena por data e soma entradas e saídas", async () => {
      const { usuario } = await criarUsuario({ nome: "Maria Operadora" });
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);
      const entrada = await criarNotaEntrada();
      const saida = await criarNotaSaida();

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        saldoAnterior: 0,
        saldoPosterior: 10,
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-15T12:00:00.000Z"),
        saldoAnterior: 10,
        saldoPosterior: 6,
        idNotaSaida: saida.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 2, {
        dataHora: new Date("2026-10-20T12:00:00.000Z"),
        saldoAnterior: 6,
        saldoPosterior: 8,
        observacao: "Ajuste de inventário",
      });
      // Fora do período: um segundo antes do início e um segundo depois do fim.
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 99, {
        dataHora: new Date("2026-09-30T23:59:59.000Z"),
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 99, {
        dataHora: new Date("2026-11-01T00:00:00.000Z"),
      });

      const resultado = await relatorioDAO.listarMovimentacoes({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T23:59:59.999Z"),
      });

      expect(resultado.data.map((m) => m.quantidade)).toEqual([10, -4, 2]);
      expect(resultado.data[0]).toMatchObject({
        id_produto: produto.id_produto,
        codigo: String(produto.id_produto).padStart(6, "0"),
        produto: "Arroz",
        tipo: "Entrada",
        documento: `NE #${entrada.id_nota_entrada}`,
        saldo_anterior: 0,
        saldo_posterior: 10,
        usuario: "Maria Operadora",
      });
      expect(resultado.data[1]).toMatchObject({
        tipo: "Saída",
        documento: `NS #${saida.id_nota_saida}`,
        saldo_anterior: 10,
        saldo_posterior: 6,
      });
      expect(resultado.data[2]).toMatchObject({
        tipo: "Ajuste",
        documento: "—",
        destinatario_fornecedor: "—",
        observacao: "Ajuste de inventário",
      });
      expect(resultado.totais).toEqual({ entradas: 12, saidas: 4 });
    });

    it("traz o destinatário da saída e o fornecedor da entrada na linha", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto);
      const { destinatario } = await criarDestinatario({ razaoSocial: "Escola Municipal" });
      const { fornecedor } = await criarFornecedor({ razaoSocial: "Distribuidora Central" });
      const entrada = await criarNotaEntrada(fornecedor.id_fornecedor);
      const saida = await criarNotaSaida({ idDestinatario: destinatario.id_destinatario });

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saida.id_nota_saida,
      });

      const resultado = await relatorioDAO.listarMovimentacoes();

      expect(resultado.data.map((m) => m.destinatario_fornecedor)).toEqual([
        "Distribuidora Central",
        "Escola Municipal",
      ]);
    });

    it("filtra por destinatário e por fornecedor, restringindo às notas correspondentes", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto);
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const fornecedorA = await criarFornecedor({ razaoSocial: "Fornecedor A" });
      const fornecedorB = await criarFornecedor({ razaoSocial: "Fornecedor B" });
      const entrada = await criarNotaEntrada(fornecedorA.fornecedor.id_fornecedor);
      const saidaA = await criarNotaSaida({
        idDestinatario: escolaA.destinatario.id_destinatario,
      });
      const saidaB = await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saidaA.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -2, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
        idNotaSaida: saidaB.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 1, {
        dataHora: new Date("2026-10-04T12:00:00.000Z"),
      });

      const porDestinatario = await relatorioDAO.listarMovimentacoes({
        id_destinatario: escolaA.destinatario.id_destinatario,
      });
      expect(porDestinatario.data).toHaveLength(1);
      expect(porDestinatario.data[0]).toMatchObject({
        tipo: "Saída",
        quantidade: -4,
        destinatario_fornecedor: "Escola A",
      });
      expect(porDestinatario.totais).toEqual({ entradas: 0, saidas: 4 });

      const porFornecedor = await relatorioDAO.listarMovimentacoes({
        id_fornecedor: fornecedorA.fornecedor.id_fornecedor,
      });
      expect(porFornecedor.data).toHaveLength(1);
      expect(porFornecedor.data[0]).toMatchObject({
        tipo: "Entrada",
        quantidade: 10,
        destinatario_fornecedor: "Fornecedor A",
      });
      expect(porFornecedor.totais).toEqual({ entradas: 10, saidas: 0 });

      const semMovimentacao = await relatorioDAO.listarMovimentacoes({
        id_fornecedor: fornecedorB.fornecedor.id_fornecedor,
      });
      expect(semMovimentacao.data).toEqual([]);
      expect(semMovimentacao.totais).toEqual({ entradas: 0, saidas: 0 });
    });

    it("lista destinatários e fornecedores por nome, só ativos, mantendo o selecionado", async () => {
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaInativa = await criarDestinatario({
        razaoSocial: "Escola Inativa",
        ativo: false,
      });
      await criarFornecedor({ razaoSocial: "Fornecedor B" });
      await criarFornecedor({ razaoSocial: "Fornecedor A" });

      const destinatarios = await relatorioDAO.listarDestinatariosParaFiltro();
      expect(destinatarios.map((d) => d.nome)).toEqual(["Escola A", "Escola B"]);
      expect(destinatarios[1]?.id_destinatario).toBe(escolaB.destinatario.id_destinatario);

      const comInativa = await relatorioDAO.listarDestinatariosParaFiltro(
        escolaInativa.destinatario.id_destinatario,
      );
      expect(comInativa.map((d) => d.nome)).toEqual([
        "Escola A",
        "Escola B",
        "Escola Inativa",
      ]);

      const fornecedores = await relatorioDAO.listarFornecedoresParaFiltro();
      expect(fornecedores.map((f) => f.nome)).toEqual(["Fornecedor A", "Fornecedor B"]);
    });

    it("filtra por produto", async () => {
      const { usuario } = await criarUsuario();
      const arroz = await criarProduto({ descricao: "Arroz" });
      const feijao = await criarProduto({ descricao: "Feijão" });
      const estoqueArroz = await criarEstoque(arroz.id_produto);
      const estoqueFeijao = await criarEstoque(feijao.id_produto);

      await criarMovimentacao(estoqueArroz.id_estoque, usuario.id_usuario, 5, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
      });
      await criarMovimentacao(estoqueFeijao.id_estoque, usuario.id_usuario, 7, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
      });

      const resultado = await relatorioDAO.listarMovimentacoes({
        id_produto: feijao.id_produto,
      });

      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0]).toMatchObject({
        id_produto: feijao.id_produto,
        produto: "Feijão",
        quantidade: 7,
      });
      expect(resultado.totais).toEqual({ entradas: 7, saidas: 0 });
    });

    it("filtra por tipo entrada e saída, deixando o ajuste só em todos", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);
      const entrada = await criarNotaEntrada();
      const saida = await criarNotaSaida();

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -3, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saida.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 1, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
      });

      const entradas = await relatorioDAO.listarMovimentacoes({ tipo: "entrada" });
      expect(entradas.data.map((m) => m.tipo)).toEqual(["Entrada"]);
      expect(entradas.totais).toEqual({ entradas: 10, saidas: 0 });

      const saidas = await relatorioDAO.listarMovimentacoes({ tipo: "saida" });
      expect(saidas.data.map((m) => m.tipo)).toEqual(["Saída"]);
      expect(saidas.totais).toEqual({ entradas: 0, saidas: 3 });

      const todos = await relatorioDAO.listarMovimentacoes({ tipo: "todos" });
      expect(todos.data.map((m) => m.tipo)).toEqual(["Entrada", "Saída", "Ajuste"]);
      expect(todos.totais).toEqual({ entradas: 11, saidas: 3 });
    });

    it("devolve lista vazia e totais zerados sem movimentações", async () => {
      const resultado = await relatorioDAO.listarMovimentacoes();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ entradas: 0, saidas: 0 });
    });
  });
});
