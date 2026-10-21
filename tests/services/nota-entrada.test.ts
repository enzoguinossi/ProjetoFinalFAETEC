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
        chave_acesso: CHAVE,
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
      include: { itens: true },
    });
    expect(nota.tipo).toBe("ENTRADA");
    expect(nota.id_fornecedor).toBeNull();
    expect(nota.observacao).toBe("NF-e de teste");
    expect(nota.data_recebimento?.toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(nota.chave_acesso).toBe(CHAVE);
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
    expect(auditorias[0]?.dados_novos).toMatchObject({ chave_acesso: CHAVE });
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
        chave_acesso: "1".repeat(43),
        itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 1 }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaEntrada.count()).toBe(0);
    expect(await prismaTeste.itemNotaEntrada.count()).toBe(0);
    expect(await prismaTeste.estoque.count()).toBe(0);
  });

  it("aceita nota de entrada sem chave de acesso", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 1 }] },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.nota.id_nota_entrada },
    });
    expect(nota.chave_acesso).toBeNull();
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
        chave_acesso: CHAVE,
        itens: [{ id_produto: produtoA.id_produto, fator_conversao: 1, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    expect("error" in primeira).toBe(false);

    await expect(
      notaEntradaService.registrar(
        {
          chave_acesso: CHAVE,
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

describe("notaEntradaService.atualizar", () => {
  /** Cria uma nota com um item e devolve os ids úteis ao teste. */
  async function prepararNota(
    idUsuario: number,
    idProduto: number,
    opts: { fator?: number; quantidade?: number } = {},
  ) {
    const resultado = await notaEntradaService.registrar(
      {
        itens: [
          {
            id_produto: idProduto,
            fator_conversao: opts.fator ?? 1,
            quantidade: opts.quantidade ?? 5,
          },
        ],
      },
      idUsuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) throw new Error(resultado.error);

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.nota.id_nota_entrada },
      include: { itens: true },
    });
    return { nota, item: nota.itens[0]! };
  }

  it("aumenta a quantidade e movimenta o estoque pelo delta positivo", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { nota, item } = await prepararNota(usuario.id_usuario, produto.id_produto, {
      quantidade: 5,
    });

    const resultado = await notaEntradaService.atualizar(
      nota.id_nota_entrada,
      {
        itens: [
          {
            id_item_nota_entrada: item.id_item_nota_entrada,
            id_produto: produto.id_produto,
            fator_conversao: 1,
            quantidade: 8,
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const estoque = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoque.quantidade_atual).toBe(8);

    const itemAtualizado = await prismaTeste.itemNotaEntrada.findUniqueOrThrow({
      where: { id_item_nota_entrada: item.id_item_nota_entrada },
    });
    expect(itemAtualizado).toMatchObject({ quantidade: 8, quantidade_convertida: 8 });

    const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_nota_entrada: nota.id_nota_entrada },
      orderBy: { id_movimentacao: "desc" },
    });
    expect(movimentacao).toMatchObject({
      id_usuario: usuario.id_usuario,
      quantidade: 3,
      saldo_anterior: 5,
      saldo_posterior: 8,
    });

    const auditorias = await auditoriasDe("NotaEntrada", nota.id_nota_entrada);
    expect(auditorias).toHaveLength(2);
    expect(auditorias[1]?.acao).toBe("ALTERAR");
    expect(auditorias[1]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[1]?.dados_anteriores).toMatchObject({
      itens: [{ quantidade: 5, quantidade_convertida: 5 }],
    });
    expect(auditorias[1]?.dados_novos).toMatchObject({
      itens: [{ quantidade: 8, quantidade_convertida: 8 }],
    });
  });

  it("diminui a quantidade e movimenta o estoque pelo delta negativo", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { nota, item } = await prepararNota(usuario.id_usuario, produto.id_produto, {
      quantidade: 5,
    });

    const resultado = await notaEntradaService.atualizar(
      nota.id_nota_entrada,
      {
        itens: [
          {
            id_item_nota_entrada: item.id_item_nota_entrada,
            id_produto: produto.id_produto,
            fator_conversao: 1,
            quantidade: 2,
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const estoque = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoque.quantidade_atual).toBe(2);

    const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_nota_entrada: nota.id_nota_entrada },
      orderBy: { id_movimentacao: "desc" },
    });
    expect(movimentacao).toMatchObject({
      quantidade: -3,
      saldo_anterior: 5,
      saldo_posterior: 2,
    });
  });

  it("acrescenta item novo e soma a quantidade convertida ao estoque", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();
    const { nota, item } = await prepararNota(usuario.id_usuario, produtoA.id_produto, {
      quantidade: 5,
    });

    const resultado = await notaEntradaService.atualizar(
      nota.id_nota_entrada,
      {
        itens: [
          {
            id_item_nota_entrada: item.id_item_nota_entrada,
            id_produto: produtoA.id_produto,
            fator_conversao: 1,
            quantidade: 5,
          },
          { id_produto: produtoB.id_produto, fator_conversao: 4, quantidade: 2 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const itens = await prismaTeste.itemNotaEntrada.findMany({
      where: { id_nota_entrada: nota.id_nota_entrada },
      orderBy: { id_item_nota_entrada: "asc" },
    });
    expect(itens).toHaveLength(2);

    const estoqueB = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produtoB.id_produto },
    });
    expect(estoqueB.quantidade_atual).toBe(8);

    const movimentacaoB = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_nota_entrada: nota.id_nota_entrada, id_estoque: estoqueB.id_estoque },
    });
    expect(movimentacaoB).toMatchObject({
      quantidade: 8,
      saldo_anterior: 0,
      saldo_posterior: 8,
    });
  });

  it("recusa remover um item existente da nota", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();

    const criada = await notaEntradaService.registrar(
      {
        itens: [
          { id_produto: produtoA.id_produto, fator_conversao: 1, quantidade: 1 },
          { id_produto: produtoB.id_produto, fator_conversao: 1, quantidade: 1 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in criada).toBe(false);
    if ("error" in criada) return;

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: criada.nota.id_nota_entrada },
      include: { itens: { orderBy: { id_item_nota_entrada: "asc" } } },
    });
    const [primeiro] = nota.itens;

    const resultado = await notaEntradaService.atualizar(
      nota.id_nota_entrada,
      {
        itens: [
          {
            id_item_nota_entrada: primeiro!.id_item_nota_entrada,
            id_produto: primeiro!.id_produto,
            fator_conversao: 1,
            quantidade: 1,
          },
        ],
      },
      usuario.id_usuario,
    );

    expect(resultado).toEqual({
      error: "Não é possível remover itens de uma nota de entrada.",
    });
    expect(
      await prismaTeste.itemNotaEntrada.count({
        where: { id_nota_entrada: nota.id_nota_entrada },
      }),
    ).toBe(2);
  });

  it("desfaz tudo quando a edição viola a unicidade da chave", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();
    const chaveA = `${"3".repeat(44)}`;
    const chaveB = `${"4".repeat(44)}`;

    const notaA = await notaEntradaService.registrar(
      {
        chave_acesso: chaveA,
        itens: [{ id_produto: produtoA.id_produto, fator_conversao: 1, quantidade: 5 }],
      },
      usuario.id_usuario,
    );
    expect("error" in notaA).toBe(false);
    if ("error" in notaA) return;

    const notaB = await notaEntradaService.registrar(
      {
        chave_acesso: chaveB,
        itens: [{ id_produto: produtoB.id_produto, fator_conversao: 1, quantidade: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in notaB).toBe(false);

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: notaA.nota.id_nota_entrada },
      include: { itens: true },
    });
    const item = nota.itens[0]!;

    await expect(
      notaEntradaService.atualizar(
        nota.id_nota_entrada,
        {
          chave_acesso: chaveB,
          itens: [
            {
              id_item_nota_entrada: item.id_item_nota_entrada,
              id_produto: produtoA.id_produto,
              fator_conversao: 1,
              quantidade: 9,
            },
          ],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow();

    const estoqueA = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produtoA.id_produto },
    });
    expect(estoqueA.quantidade_atual).toBe(5);

    const itemDepois = await prismaTeste.itemNotaEntrada.findUniqueOrThrow({
      where: { id_item_nota_entrada: item.id_item_nota_entrada },
    });
    expect(itemDepois.quantidade).toBe(5);

    const notaDepois = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: nota.id_nota_entrada },
    });
    expect(notaDepois.chave_acesso).toBe(chaveA);

    // Só as duas entradas originais; nenhuma movimentação/auditoria da edição.
    expect(await prismaTeste.movimentacaoEstoque.count()).toBe(2);
    expect(await auditoriasDe("NotaEntrada", nota.id_nota_entrada)).toHaveLength(1);
  });
});

describe("notaEntradaDAO.list", () => {
  it("pagina as notas de entrada e traz itens e chave de acesso", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    for (let i = 0; i < 2; i++) {
      const resultado = await notaEntradaService.registrar(
        {
          chave_acesso: `${i}${"2".repeat(43)}`,
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
    expect(pagina.data[0]?.chave_acesso).toHaveLength(44);
  });
});
