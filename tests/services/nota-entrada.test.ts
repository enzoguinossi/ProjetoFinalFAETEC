import { describe, expect, it } from "vitest";
import { estoqueDAO } from "@/dao/estoque";
import { notaEntradaDAO } from "@/dao/nota-entrada";
import { notaEntradaService } from "@/services/nota-entrada";
import { criarConversao, criarEstoque, criarProduto, criarUsuario } from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

const CHAVE = "1".repeat(44);

describe("notaEntradaService.registrar", () => {
  it("grava nota, dois itens (um com conversão) e movimentações com saldos", async () => {
    const { usuario } = await criarUsuario();
    const caixa = await criarConversao("CX12", 12);
    const produtoComConversao = await criarProduto({ idConversaoPadrao: caixa.id_conversao });
    const produtoSimples = await criarProduto();

    const resultado = await notaEntradaService.registrar(
      {
        data_recebimento: "2026-10-19",
        chaves_acesso: [CHAVE],
        observacao: "NF-e de teste",
        itens: [
          { id_produto: produtoComConversao.id_produto, fator_conversao: 12, quantidade: 2 },
          { id_produto: produtoSimples.id_produto, fator_conversao: 1, quantidade: 5 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.nota.id_nota_entrada },
      include: { itens: true, chavesAcesso: true },
    });
    expect(nota.tipo).toBe("ENTRADA");
    expect(nota.id_fornecedor).toBeNull();
    expect(nota.observacao).toBe("NF-e de teste");
    expect(nota.data_recebimento?.toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(nota.chavesAcesso.map((c) => c.chave_acesso)).toEqual([CHAVE]);
    expect(nota.itens).toHaveLength(2);

    const itemComConversao = nota.itens.find(
      (i) => i.id_produto === produtoComConversao.id_produto,
    );
    expect(itemComConversao).toMatchObject({
      fator_conversao: 12,
      quantidade: 2,
      quantidade_convertida: 24,
    });

    const estoqueComConversao = await prismaTeste.estoque.findMany({
      where: { id_produto: produtoComConversao.id_produto },
    });
    expect(estoqueComConversao).toHaveLength(1);
    expect(estoqueComConversao[0]?.quantidade_atual).toBe(24);
    expect(estoqueComConversao[0]?.data_entrada.toISOString().slice(0, 10)).toBe("2026-10-19");

    const estoqueSimples = await prismaTeste.estoque.findMany({
      where: { id_produto: produtoSimples.id_produto },
    });
    expect(estoqueSimples[0]?.quantidade_atual).toBe(5);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_nota_entrada: nota.id_nota_entrada },
      orderBy: { id_movimentacao: "asc" },
    });
    expect(movimentacoes).toHaveLength(2);
    expect(movimentacoes[0]).toMatchObject({
      id_estoque: estoqueComConversao[0]?.id_estoque,
      id_usuario: usuario.id_usuario,
      quantidade: 24,
      saldo_anterior: 0,
      saldo_posterior: 24,
    });
    expect(movimentacoes[1]).toMatchObject({
      id_estoque: estoqueSimples[0]?.id_estoque,
      quantidade: 5,
      saldo_anterior: 0,
      saldo_posterior: 5,
    });

    const auditorias = await auditoriasDe("NotaEntrada", nota.id_nota_entrada);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("CRIAR");
    expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[0]?.dados_novos).toMatchObject({ chaves_acesso: [CHAVE] });
  });

  it("reaproveita a linha de estoque do produto na segunda entrada", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const primeira = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 12, quantidade: 2 }] },
      usuario.id_usuario,
    );
    expect("error" in primeira).toBe(false);

    const estoqueAntes = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(estoqueAntes).toHaveLength(1);
    expect(estoqueAntes[0]?.quantidade_atual).toBe(24);

    const segunda = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 6, quantidade: 1 }] },
      usuario.id_usuario,
    );
    expect("error" in segunda).toBe(false);

    const estoqueDepois = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(estoqueDepois).toHaveLength(1);
    expect(estoqueDepois[0]?.id_estoque).toBe(estoqueAntes[0]?.id_estoque);
    expect(estoqueDepois[0]?.quantidade_atual).toBe(30);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_estoque: estoqueDepois[0]?.id_estoque },
      orderBy: { id_movimentacao: "asc" },
    });
    expect(movimentacoes).toHaveLength(2);
    expect(movimentacoes[1]).toMatchObject({ quantidade: 6, saldo_anterior: 24, saldo_posterior: 30 });
  });

  it("reativa a linha de estoque inativa do produto em vez de criar outra", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const inativa = await criarEstoque(produto.id_produto, { quantidadeAtual: 7, ativo: false });

    const resultado = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 5 }] },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const linhas = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id_estoque: inativa.id_estoque,
      ativo: true,
      quantidade_atual: 12,
    });

    const saldo = await estoqueDAO.getSaldoDisponivel(produto.id_produto);
    expect(saldo.saldo_disponivel).toBe(12);

    const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_estoque: inativa.id_estoque },
    });
    expect(movimentacao).toMatchObject({ saldo_anterior: 7, saldo_posterior: 12 });
  });

  it("recusa chave de acesso com menos de 44 caracteres sem gravar nada", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaEntradaService.registrar(
      {
        chaves_acesso: ["1".repeat(43)],
        itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 1 }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaEntrada.count()).toBe(0);
    expect(await prismaTeste.itemNotaEntrada.count()).toBe(0);
    expect(await prismaTeste.estoque.count()).toBe(0);
  });

  it("recusa mais de uma chave de acesso na mesma nota sem gravar nada", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaEntradaService.registrar(
      {
        chaves_acesso: ["1".repeat(44), "2".repeat(44)],
        itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 1 }],
      },
      usuario.id_usuario,
    );

    expect(resultado).toEqual({
      error: "A nota de entrada aceita apenas uma chave de acesso da NF-e.",
    });
    expect(await prismaTeste.notaEntrada.count()).toBe(0);
    expect(await prismaTeste.itemNotaEntrada.count()).toBe(0);
    expect(await prismaTeste.estoque.count()).toBe(0);
  });

  it("recusa nota sem itens", async () => {
    const { usuario } = await criarUsuario();

    const resultado = await notaEntradaService.registrar({ itens: [] }, usuario.id_usuario);

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaEntrada.count()).toBe(0);
  });

  it("recusa produto repetido na mesma nota", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaEntradaService.registrar(
      {
        itens: [
          { id_produto: produto.id_produto, fator_conversao: 1, quantidade: 1 },
          { id_produto: produto.id_produto, fator_conversao: 1, quantidade: 2 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaEntrada.count()).toBe(0);
  });

  it("desfaz a transação quando a chave de acesso já existe em outra nota", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();

    const primeira = await notaEntradaService.registrar(
      {
        chaves_acesso: [CHAVE],
        itens: [{ id_produto: produtoA.id_produto, fator_conversao: 1, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    expect("error" in primeira).toBe(false);

    await expect(
      notaEntradaService.registrar(
        {
          chaves_acesso: [CHAVE],
          itens: [{ id_produto: produtoB.id_produto, fator_conversao: 1, quantidade: 2 }],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow();

    expect(await prismaTeste.notaEntrada.count()).toBe(1);
    expect(await prismaTeste.itemNotaEntrada.count()).toBe(1);
    expect(await prismaTeste.movimentacaoEstoque.count()).toBe(1);
    expect(await prismaTeste.estoque.count({ where: { id_produto: produtoB.id_produto } })).toBe(0);
  });

  it("aceita fornecedor ausente e quantidade/fator inválidos são recusados", async () => {    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const semFornecedor = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 3 }] },
      usuario.id_usuario,
    );
    expect("error" in semFornecedor).toBe(false);
    if ("error" in semFornecedor) return;

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: semFornecedor.nota.id_nota_entrada },
    });
    expect(nota.id_fornecedor).toBeNull();

    const quantidadeInvalida = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 0 }] },
      usuario.id_usuario,
    );
    expect("error" in quantidadeInvalida).toBe(true);

    const fatorInvalido = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 0, quantidade: 1 }] },
      usuario.id_usuario,
    );
    expect("error" in fatorInvalido).toBe(true);
  });
});

describe("notaEntradaDAO.list", () => {
  it("pagina as notas de entrada e traz itens e chaves", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    for (let i = 0; i < 2; i++) {
      const resultado = await notaEntradaService.registrar(
        {
          chaves_acesso: [`${i}${"2".repeat(43)}`],
          itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: i + 1 }],
        },
        usuario.id_usuario,
      );
      expect("error" in resultado).toBe(false);
    }

    const pagina = await notaEntradaDAO.list({ page: 1, limit: 1 });

    expect(pagina.total).toBe(2);
    expect(pagina.totalPages).toBe(2);
    expect(pagina.data).toHaveLength(1);
    expect(pagina.data[0]?.itens).toHaveLength(1);
    expect(pagina.data[0]?.chavesAcesso).toHaveLength(1);
  });
});
