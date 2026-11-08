import { describe, expect, it } from "vitest";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { notaSaidaService } from "@/services/nota-saida";
import { expedicaoService } from "@/services/expedicao";
import { itemSaidaDetalhe } from "@/app/mov-estoque/nota-saida-linha";
import {
  criarConversao,
  criarDestinatario,
  criarEstoque,
  criarExpedicao,
  criarInventarioComItem,
  criarItemNotaSaida,
  criarNotaSaida,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

/** Nota aberta com um item e a reserva já feita. */
async function prepararNota(
  opts: { quantidade?: number; saldoReservado?: number; quantidadeAtual?: number } = {},
) {
  const { usuario } = await criarUsuario();
  const produto = await criarProduto();
  const estoque = await criarEstoque(produto.id_produto, {
    quantidadeAtual: opts.quantidadeAtual ?? 10,
    saldoReservado: opts.saldoReservado ?? 2,
  });
  const { destinatario } = await criarDestinatario();

  const resultado = await notaSaidaService.registrar(
    {
      tipo: "SAIDA",
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade_solicitada: opts.quantidade ?? 3 }],
    },
    usuario.id_usuario,
  );
  if ("error" in resultado) throw new Error(resultado.error);

  const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
    where: { id_nota_saida: resultado.nota.id_nota_saida },
    include: { itens: true, reservas: true },
  });

  return {
    usuario,
    produto,
    estoque,
    destinatario,
    notaId: nota.id_nota_saida,
    item: nota.itens[0]!,
  };
}

describe("notaSaidaService.registrar", () => {
  it("grava a nota com destinatário, urgência, itens e reserva", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();
    await criarEstoque(produtoA.id_produto, { quantidadeAtual: 10 });
    await criarEstoque(produtoB.id_produto, { quantidadeAtual: 10 });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        urgente: true,
        observacao: "Saída de teste",
        itens: [
          { id_produto: produtoA.id_produto, quantidade_solicitada: 3 },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 7 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
      include: { itens: true, reservas: true, destinatario: true },
    });
    expect(nota.tipo).toBe("SAIDA");
    expect(nota.status).toBe("ABERTA");
    expect(nota.urgente).toBe(true);
    expect(nota.observacao).toBe("Saída de teste");
    expect(nota.id_destinatario).toBe(destinatario.id_destinatario);
    expect(nota.destinatario?.id_destinatario).toBe(destinatario.id_destinatario);
    expect(nota.itens).toHaveLength(2);
    expect(nota.itens.map((item) => Number(item.qtd_esperada))).toEqual([3, 7]);
    expect(nota.reservas).toHaveLength(2);
    expect(resultado.aviso).toBeNull();

    const auditorias = await auditoriasDe("NotaSaida", nota.id_nota_saida);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("CRIAR");
    expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[0]?.dados_novos).toMatchObject({
      id_destinatario: destinatario.id_destinatario,
      status: "ABERTA",
      itens: expect.arrayContaining([
        expect.objectContaining({ id_produto: produtoA.id_produto, quantidade_solicitada: 3 }),
        expect.objectContaining({ id_produto: produtoB.id_produto, quantidade_solicitada: 7 }),
      ]),
    });
  });

  it("reserva o valor cheio de cada item com saldo anterior e posterior", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 2,
    });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 3 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
      include: { itens: true, reservas: true },
    });
    expect(nota.itens).toHaveLength(1);
    expect(nota.itens[0]).toMatchObject({
      id_produto: estoque.id_produto,
      qtd_esperada: 3,
    });

    expect(nota.reservas).toHaveLength(1);
    expect(nota.reservas[0]).toMatchObject({
      id_produto: estoque.id_produto,
      id_nota_saida: nota.id_nota_saida,
      id_usuario: usuario.id_usuario,
      quantidade: 3,
      saldo_anterior: 2,
      saldo_posterior: 5,
    });

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(estoqueApos.saldo).toBe(10);
  });

  it("RN001: grava mesmo acima do saldo disponível e devolve o aviso", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 2 });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 5 }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;
    expect(resultado.aviso).toContain("Saldo insuficiente");
    expect(await prismaTeste.notaSaida.count()).toBe(1);

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(Number(estoqueApos.saldo) - Number(estoqueApos.saldo_reservado)).toBe(-3);
  });

  it("cria a linha de estoque com saldo 0 quando o produto não tem estoque", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 4 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const linhas = await prismaTeste.produto.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ saldo: 0, saldo_reservado: 4, ativo: true });
  });

  it("reserva no produto mesmo sem saldo prévio", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const linha = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(linha).toMatchObject({
      id_produto: produto.id_produto,
      ativo: true,
      saldo: 0,
      saldo_reservado: 2,
    });
  });

  it("recusa nota sem item", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      { tipo: "SAIDA", id_destinatario: destinatario.id_destinatario, itens: [] },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("recusa nota sem destinatário", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: 0,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("recusa produto repetido na mesma nota", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [
          { id_produto: produto.id_produto, quantidade_solicitada: 1 },
          { id_produto: produto.id_produto, quantidade_solicitada: 2 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.reservaEstoque.count()).toBe(0);
  });

  it("desfaz tudo quando um item falha no meio da transação", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    await expect(
      notaSaidaService.registrar(
        {
          tipo: "SAIDA",
          id_destinatario: destinatario.id_destinatario,
          itens: [
            { id_produto: produto.id_produto, quantidade_solicitada: 2 },
            { id_produto: 999999, quantidade_solicitada: 1 },
          ],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow();

    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.itemNotaSaida.count()).toBe(0);
    expect(await prismaTeste.reservaEstoque.count()).toBe(0);
    expect(await prismaTeste.registroAuditoria.count({ where: { entidade: "NotaSaida" } })).toBe(0);
  });
});

describe("nota de saída com unidade de saída (Remessa)", () => {
  it("converte a quantidade de CAIXA para base e grava o snapshot no item", async () => {
    const { usuario } = await criarUsuario();
    const caixa = await criarConversao("CAIXA50", 50);
    const produto = await criarProduto({ idConversaoSaida: caixa.id_conversao });
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 200,
      saldoReservado: 0,
    });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const item = await prismaTeste.itemNotaSaida.findFirstOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
    });
    expect(item).toMatchObject({
      qtd_esperada: 100,
      qtd_entregue: 0,
    });

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(100);
    expect(estoqueApos.saldo).toBe(200);
  });

  it("aviso RN001 mostra o total e o fator auxiliar", async () => {
    const { usuario } = await criarUsuario();
    const caixa = await criarConversao("CAIXA50", 50);
    const produto = await criarProduto({ idConversaoSaida: caixa.id_conversao });
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;
    expect(resultado.aviso).toContain("2 × 50 = 100");
    expect(resultado.aviso).toContain("disponível 10");
  });

  it("edita pela unidade gravada e usa a unidade atual só no item novo", async () => {
    const { usuario } = await criarUsuario();
    const caixa = await criarConversao("CAIXA50", 50);
    const caixaPequena = await criarConversao("CX10", 10);
    const produto = await criarProduto({ idConversaoSaida: caixa.id_conversao });
    const produtoB = await criarProduto({ idConversaoSaida: caixaPequena.id_conversao });
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 200,
      saldoReservado: 0,
    });
    await criarEstoque(produtoB.id_produto, { quantidadeAtual: 50 });
    const { destinatario } = await criarDestinatario();

    const criada = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in criada).toBe(false);
    if ("error" in criada) return;

    const item = await prismaTeste.itemNotaSaida.findFirstOrThrow({
      where: { id_nota_saida: criada.nota.id_nota_saida },
    });

    const editada = await notaSaidaService.atualizar(
      criada.nota.id_nota_saida,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 150,
          },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 4 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in editada).toBe(false);

    const itens = await prismaTeste.itemNotaSaida.findMany({
      where: { id_nota_saida: criada.nota.id_nota_saida },
      orderBy: { id_item_nota_saida: "asc" },
    });
    expect(itens[0]).toMatchObject({
      qtd_esperada: 150,
    });
    expect(itens[1]).toMatchObject({
      qtd_esperada: 40,
    });

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(150);
  });

  it("Avaria/Consumo usam apenas o total", async () => {
    const { usuario } = await criarUsuario();
    const caixa = await criarConversao("CAIXA50", 50);
    const produto = await criarProduto({ idConversaoSaida: caixa.id_conversao });
    const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 20 });

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "AVARIA",
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 4 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const item = await prismaTeste.itemNotaSaida.findFirstOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
    });
    expect(item).toMatchObject({
      qtd_esperada: 4,
      qtd_entregue: 4,
    });

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo).toBe(16);
  });

  it("nota antiga cai no total guardado e não exibe unidade", async () => {
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
    const nota = await prismaTeste.notaSaida.create({
      data: {
        data_criacao: new Date(),
        tipo: "SAIDA",
        status: "BAIXA_TOTAL",
      },
    });
    const item = await prismaTeste.itemNotaSaida.create({
      data: {
        id_nota_saida: nota.id_nota_saida,
        id_produto: estoque.id_produto,
        qtd_esperada: 3,
        qtd_entregue: 3,
      },
    });

    const detalhe = itemSaidaDetalhe({
      ...item,
      produto: { id_produto: produto.id_produto, descricao: produto.descricao },
    });

    expect(detalhe).toMatchObject({
      quantidade_solicitada: 3,
      quantidade_entregue: 3,
    });
  });
});

describe("notaSaidaService.atualizar", () => {
  it("edita nota antiga usando o total guardado", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 3,
    });
    const { destinatario } = await criarDestinatario();
    const nota = await criarNotaSaida({
      idDestinatario: destinatario.id_destinatario,
      status: "ABERTA",
    });
    const item = await criarItemNotaSaida(
      nota.id_nota_saida,
      estoque.id_produto,
      3,
    );

    const resultado = await notaSaidaService.atualizar(
      nota.id_nota_saida,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 2,
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(itemDepois).toMatchObject({
      qtd_esperada: 2,
    });

    const estoqueDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueDepois.saldo_reservado).toBe(2);
  });

  it("aumenta a quantidade e ajusta a reserva pelo delta", async () => {
    const { usuario, produto, estoque, destinatario, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    const resultado = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        urgente: true,
        observacao: "Correção da quantidade",
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 8,
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);

    const estoqueDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueDepois.saldo_reservado).toBe(10);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(itemDepois.qtd_esperada).toBe(8);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: notaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      id_produto: estoque.id_produto,
      id_nota_saida: notaId,
      id_usuario: usuario.id_usuario,
      quantidade: 5,
      saldo_anterior: 5,
      saldo_posterior: 10,
    });

    const notaDepois = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaDepois.observacao).toBe("Correção da quantidade");
    expect(notaDepois.urgente).toBe(true);

    const auditorias = await auditoriasDe("NotaSaida", notaId);
    expect(auditorias).toHaveLength(2);
    expect(auditorias[1]?.acao).toBe("ALTERAR");
    expect(auditorias[1]?.dados_anteriores).toMatchObject({
      itens: [{ id_item_nota_saida: item.id_item_nota_saida, quantidade_solicitada: 3 }],
    });
    expect(auditorias[1]?.dados_novos).toMatchObject({
      itens: [{ id_item_nota_saida: item.id_item_nota_saida, quantidade_solicitada: 8 }],
    });
  });

  it("diminui a quantidade e devolve a reserva pelo delta negativo", async () => {
    const { usuario, produto, estoque, destinatario, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    const resultado = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 1,
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);

    const estoqueDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueDepois.saldo_reservado).toBe(3);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: notaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      quantidade: -2,
      saldo_anterior: 5,
      saldo_posterior: 3,
    });

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(itemDepois.qtd_esperada).toBe(1);
  });

  it("acrescenta item novo e reserva o valor cheio", async () => {
    const { usuario, produto, estoque, destinatario, notaId, item } = await prepararNota({
      quantidade: 3,
    });
    const produtoB = await criarProduto();

    const resultado = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 4 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);

    const itens = await prismaTeste.itemNotaSaida.findMany({
      where: { id_nota_saida: notaId },
      orderBy: { id_item_nota_saida: "asc" },
    });
    expect(itens).toHaveLength(2);

    const estoqueB = await prismaTeste.produto.findFirstOrThrow({
      where: { id_produto: produtoB.id_produto },
    });
    expect(estoqueB.saldo_reservado).toBe(4);
    expect(itens[1]?.id_produto).toBe(estoqueB.id_produto);

    const reservaB = await prismaTeste.reservaEstoque.findFirstOrThrow({
      where: { id_produto: estoqueB.id_produto },
    });
    expect(reservaB).toMatchObject({
      id_nota_saida: notaId,
      id_usuario: usuario.id_usuario,
      quantidade: 4,
      saldo_anterior: 0,
      saldo_posterior: 4,
    });

    // O item original não foi tocado: nenhuma reserva de ajuste para ele.
    const reservasA = await prismaTeste.reservaEstoque.findMany({
      where: { id_produto: estoque.id_produto },
    });
    expect(reservasA).toHaveLength(1);
  });

  it.each(["EM_PERCURSO", "PENDENTE", "BAIXA_TOTAL", "BAIXA_PARCIAL", "CANCELADA"] as const)(
    "recusa editar nota %s sem alterar reserva nem histórico",
    async (status) => {
      const { usuario, produto, estoque, destinatario, notaId, item } = await prepararNota({
        quantidade: 3,
      });
      await prismaTeste.notaSaida.update({
        where: { id_nota_saida: notaId },
        data: { status },
      });

      const resultado = await notaSaidaService.atualizar(
        notaId,
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [
            {
              id_item_nota_saida: item.id_item_nota_saida,
              id_produto: produto.id_produto,
              quantidade_solicitada: 9,
            },
          ],
        },
        usuario.id_usuario,
      );

      expect("error" in resultado).toBe(true);
      if ("error" in resultado) expect(resultado.error).toContain("não pode ser editada");

      const estoqueDepois = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: estoque.id_produto },
      });
      expect(estoqueDepois.saldo_reservado).toBe(5);

      const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
        where: { id_item_nota_saida: item.id_item_nota_saida },
      });
      expect(itemDepois.qtd_esperada).toBe(3);

      expect(await prismaTeste.reservaEstoque.count({ where: { id_nota_saida: notaId } })).toBe(1);
      expect(await auditoriasDe("NotaSaida", notaId)).toHaveLength(1);
    },
  );

  it("recusa remover item de uma nota", async () => {
    const { usuario, produto, destinatario, notaId, item } = await prepararNota({
      quantidade: 3,
    });
    const produtoB = await criarProduto();

    const comDois = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 2 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in comDois).toBe(false);

    const resultado = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
        ],
      },
      usuario.id_usuario,
    );

    expect(resultado).toEqual({
      error: "Não é possível remover itens de uma nota de saída.",
    });
    expect(await prismaTeste.itemNotaSaida.count({ where: { id_nota_saida: notaId } })).toBe(2);
  });

  it("recusa quantidade inválida e nota inexistente", async () => {
    const { usuario, produto, destinatario, notaId, item } = await prepararNota();

    const quantidadeInvalida = await notaSaidaService.atualizar(
      notaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: produto.id_produto,
            quantidade_solicitada: 0,
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in quantidadeInvalida).toBe(true);

    const inexistente = await notaSaidaService.atualizar(
      999999,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );
    expect(inexistente).toEqual({ error: "Nota de saída não encontrada." });
  });

  it("desfaz tudo quando um item novo viola a integridade do banco", async () => {
    const { usuario, produto, estoque, destinatario, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    await expect(
      notaSaidaService.atualizar(
        notaId,
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [
            {
              id_item_nota_saida: item.id_item_nota_saida,
              id_produto: produto.id_produto,
              quantidade_solicitada: 9,
            },
            { id_produto: 999999, quantidade_solicitada: 4 },
          ],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow();

    const estoqueDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueDepois.saldo_reservado).toBe(5);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(itemDepois.qtd_esperada).toBe(3);

    // Só a reserva da criação; nenhuma auditoria de edição.
    expect(await prismaTeste.reservaEstoque.count({ where: { id_nota_saida: notaId } })).toBe(1);
    expect(await auditoriasDe("NotaSaida", notaId)).toHaveLength(1);
  });
});

describe("notaSaidaService.cancelar", () => {
  it("cancela uma nota aberta e devolve o saldo_reservado ao valor anterior", async () => {
    const { usuario, estoque, notaId } = await prepararNota({ quantidade: 3 });

    const cancelamento = await notaSaidaService.cancelar(notaId, usuario.id_usuario);

    expect("error" in cancelamento).toBe(false);

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(2);
    expect(estoqueApos.saldo).toBe(10);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: notaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      id_produto: estoque.id_produto,
      id_nota_saida: notaId,
      id_usuario: usuario.id_usuario,
      quantidade: -3,
      saldo_anterior: 5,
      saldo_posterior: 2,
    });

    // A nota não é apagada (RN004).
    const notaApos = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaApos.status).toBe("CANCELADA");

    const auditorias = await auditoriasDe("NotaSaida", notaId);
    expect(auditorias).toHaveLength(2);
    expect(auditorias[1]?.acao).toBe("ALTERAR");
    expect(auditorias[1]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[1]?.dados_anteriores).toMatchObject({
      id_nota_saida: notaId,
      status: "ABERTA",
    });
    expect(auditorias[1]?.dados_novos).toMatchObject({
      id_nota_saida: notaId,
      status: "CANCELADA",
    });
  });

  it("recusa o segundo cancelamento e não debita a reserva outra vez", async () => {
    const { usuario, estoque, notaId } = await prepararNota({ quantidade: 3 });

    const primeiro = await notaSaidaService.cancelar(notaId, usuario.id_usuario);
    expect("error" in primeiro).toBe(false);

    const segundo = await notaSaidaService.cancelar(notaId, usuario.id_usuario);
    expect("error" in segundo).toBe(true);
    if ("error" in segundo) expect(segundo.error).toContain("já está cancelada");

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(2);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: notaId },
    });
    expect(reservas).toHaveLength(2);
  });

  it.each(["EM_PERCURSO", "PENDENTE", "BAIXA_TOTAL", "BAIXA_PARCIAL", "BAIXA_COM_CORTE"] as const)(
    "recusa cancelar nota %s sem alterar a reserva",
    async (status) => {
      const { usuario, estoque, notaId } = await prepararNota({ quantidade: 3 });
      await prismaTeste.notaSaida.update({
        where: { id_nota_saida: notaId },
        data: { status },
      });

      const cancelamento = await notaSaidaService.cancelar(notaId, usuario.id_usuario);

      expect("error" in cancelamento).toBe(true);
      if ("error" in cancelamento) expect(cancelamento.error).toContain("não pode ser cancelada");

      const notaApos = await prismaTeste.notaSaida.findUniqueOrThrow({
        where: { id_nota_saida: notaId },
      });
      expect(notaApos.status).toBe(status);

      const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: estoque.id_produto },
      });
      expect(estoqueApos.saldo_reservado).toBe(5);

      expect(await prismaTeste.reservaEstoque.count({ where: { id_nota_saida: notaId } })).toBe(1);
      expect(await auditoriasDe("NotaSaida", notaId)).toHaveLength(1);
    },
  );

  it("recusa nota inexistente", async () => {
    const { usuario } = await criarUsuario();

    const cancelamento = await notaSaidaService.cancelar(999999, usuario.id_usuario);

    expect("error" in cancelamento).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });
});

describe("notaSaidaService.retirar", () => {
  it("retirada parcial baixa saldo e reserva, conta como entregue e audita antes/depois", async () => {
    const { usuario, produto, estoque, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    const resultado = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.status).toBe("BAIXA_PARCIAL");
    expect(resultado.itens).toContainEqual({
      id_item_nota_saida: item.id_item_nota_saida,
      qtd_entregue: 1,
    });
    expect(resultado.movimentacoes).toHaveLength(1);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(Number(itemDepois.qtd_entregue)).toBe(1);

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(produtoDepois.saldo).toBe(9);
    expect(produtoDepois.saldo_reservado).toBe(4);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_nota_saida: notaId },
    });
    expect(movimentacoes).toHaveLength(1);
    expect(movimentacoes[0]).toMatchObject({
      id_produto: produto.id_produto,
      id_nota_saida: notaId,
      id_usuario: usuario.id_usuario,
      quantidade: -1,
      saldo_anterior: 10,
      saldo_posterior: 9,
      observacao: "Retirada direta de itens da nota de saída",
    });

    const notaDepois = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaDepois.status).toBe("BAIXA_PARCIAL");

    const auditorias = await auditoriasDe("NotaSaida", notaId);
    expect(auditorias).toHaveLength(2);
    const auditoria = auditorias[1]!;
    expect(auditoria.acao).toBe("ALTERAR");
    expect(auditoria.id_usuario).toBe(usuario.id_usuario);
    expect(auditoria.dados_anteriores).toMatchObject({
      id_nota_saida: notaId,
      status: "ABERTA",
      itens: [
        {
          id_item_nota_saida: item.id_item_nota_saida,
          id_produto: produto.id_produto,
          qtd_esperada: 3,
          qtd_entregue: 0,
        },
      ],
      saldos: [
        {
          id_produto: produto.id_produto,
          saldo: 10,
          saldo_reservado: 5,
        },
      ],
    });
    expect(auditoria.dados_novos).toMatchObject({
      id_nota_saida: notaId,
      status: "BAIXA_PARCIAL",
      itens: [
        {
          id_item_nota_saida: item.id_item_nota_saida,
          qtd_entregue: 1,
        },
      ],
      saldos: [
        {
          id_produto: produto.id_produto,
          saldo: 9,
          saldo_reservado: 4,
        },
      ],
      movimentacoes: [
        {
          id_produto: produto.id_produto,
          quantidade: -1,
          saldo_anterior: 10,
          saldo_posterior: 9,
        },
      ],
    });
  });

  it("retirada total zera o pendente e vira BAIXA_TOTAL", async () => {
    const { usuario, estoque, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    const resultado = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 3 }],
      usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.status).toBe("BAIXA_TOTAL");

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(Number(itemDepois.qtd_entregue)).toBe(3);

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(produtoDepois.saldo).toBe(7);
    expect(produtoDepois.saldo_reservado).toBe(2);

    const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(movimentacao).toMatchObject({ quantidade: -3 });

    const notaDepois = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaDepois.status).toBe("BAIXA_TOTAL");
  });

  it("soma retiradas parciais até completar a nota sem passar do pendente", async () => {
    const { usuario, notaId, item } = await prepararNota({ quantidade: 3 });

    const primeira = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );
    if ("error" in primeira) throw new Error(primeira.error);
    expect(primeira.status).toBe("BAIXA_PARCIAL");

    const segunda = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 2 }],
      usuario.id_usuario,
    );
    if ("error" in segunda) throw new Error(segunda.error);
    expect(segunda.status).toBe("BAIXA_TOTAL");

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(Number(itemDepois.qtd_entregue)).toBe(3);

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: item.id_produto },
    });
    expect(produtoDepois.saldo).toBe(7);
    expect(produtoDepois.saldo_reservado).toBe(2);
  });

  it("recusa acima do pendente, delta negativo/NaN, item de outra nota e nota sem item", async () => {
    const { usuario, estoque, notaId, item } = await prepararNota({
      quantidade: 3,
    });

    const acima = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 4 }],
      usuario.id_usuario,
    );
    expect(acima).toMatchObject({ error: expect.stringContaining("pendente") });

    const negativo = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: -1 }],
      usuario.id_usuario,
    );
    expect(negativo).toEqual({ error: "Quantidade de retirada inválida." });

    const nan = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: Number.NaN }],
      usuario.id_usuario,
    );
    expect(nan).toEqual({ error: "Quantidade de retirada inválida." });

    const outraNota = await criarNotaSaida();
    const itemDeOutra = await criarItemNotaSaida(
      outraNota.id_nota_saida,
      estoque.id_produto,
      1,
    );
    const alheio = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: itemDeOutra.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );
    expect(alheio).toEqual({
      error: "Item informado não pertence a esta nota de saída.",
    });

    const semItens = await notaSaidaService.retirar(notaId, [], usuario.id_usuario);
    expect(semItens).toEqual({ error: "Informe ao menos um item para retirar." });

    const todosZero = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 0 }],
      usuario.id_usuario,
    );
    expect(todosZero).toEqual({
      error: "Informe ao menos uma quantidade para retirar.",
    });

    const notaVazia = await criarNotaSaida();
    const vazia = await notaSaidaService.retirar(
      notaVazia.id_nota_saida,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );
    expect(vazia).toEqual({
      error: "Item informado não pertence a esta nota de saída.",
    });

    // Nada mudou: nem item, nem saldo, nem histórico.
    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(Number(itemDepois.qtd_entregue)).toBe(0);
    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(produtoDepois.saldo).toBe(10);
    expect(produtoDepois.saldo_reservado).toBe(5);
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_saida: notaId },
      }),
    ).toBe(0);
    expect(await auditoriasDe("NotaSaida", notaId)).toHaveLength(1);
  });

  it.each(["CANCELADA", "BAIXA_TOTAL", "BAIXA_COM_CORTE"] as const)(
    "recusa retirada em nota %s",
    async (status) => {
      const { usuario, notaId, item } = await prepararNota({ quantidade: 3 });
      await prismaTeste.notaSaida.update({
        where: { id_nota_saida: notaId },
        data: { status },
      });

      const resultado = await notaSaidaService.retirar(
        notaId,
        [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 1 }],
        usuario.id_usuario,
      );

      expect(resultado).toMatchObject({
        error: expect.stringContaining("não permite retirada"),
      });
      const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
        where: { id_item_nota_saida: item.id_item_nota_saida },
      });
      expect(Number(itemDepois.qtd_entregue)).toBe(0);
    },
  );

  it("recusa retirada em item já completo mesmo com outro item pendente", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();
    await criarEstoque(produtoA.id_produto, { quantidadeAtual: 10 });
    await criarEstoque(produtoB.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 3,
    });
    const nota = await criarNotaSaida({
      idDestinatario: destinatario.id_destinatario,
      status: "BAIXA_PARCIAL",
    });
    const itemA = await criarItemNotaSaida(
      nota.id_nota_saida,
      produtoA.id_produto,
      3,
    );
    await prismaTeste.itemNotaSaida.update({
      where: { id_item_nota_saida: itemA.id_item_nota_saida },
      data: { qtd_entregue: 3 },
    });
    await criarItemNotaSaida(nota.id_nota_saida, produtoB.id_produto, 3);

    const resultado = await notaSaidaService.retirar(
      nota.id_nota_saida,
      [{ id_item_nota_saida: itemA.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );

    expect(resultado).toMatchObject({
      error: expect.stringContaining("já está completo"),
    });
  });

  it("recusa retirada em nota de avaria (já baixada na criação)", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
    const nota = await criarNotaSaida({ tipo: "AVARIA", status: "BAIXA_TOTAL" });
    const item = await criarItemNotaSaida(nota.id_nota_saida, produto.id_produto, 2);

    const resultado = await notaSaidaService.retirar(
      nota.id_nota_saida,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 1 }],
      usuario.id_usuario,
    );

    expect(resultado).toMatchObject({
      error: expect.stringContaining("notas de remessa"),
    });
  });

  it("recusa reserva insuficiente e produto bloqueado por inventário ativo", async () => {
    const { usuario } = await criarUsuario();

    // Sem reserva: a baixa aborta sem deixar saldo_reservado negativo.
    const produtoSemReserva = await criarProduto();
    await criarEstoque(produtoSemReserva.id_produto, { quantidadeAtual: 10 });
    const notaSemReserva = await criarNotaSaida();
    const itemSemReserva = await criarItemNotaSaida(
      notaSemReserva.id_nota_saida,
      produtoSemReserva.id_produto,
      2,
    );

    await expect(
      notaSaidaService.retirar(
        notaSemReserva.id_nota_saida,
        [
          {
            id_item_nota_saida: itemSemReserva.id_item_nota_saida,
            quantidade: 1,
          },
        ],
        usuario.id_usuario,
      ),
    ).rejects.toThrow("Saldo reservado insuficiente");

    const produtoSemReservaDepois =
      await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: produtoSemReserva.id_produto },
      });
    expect(produtoSemReservaDepois.saldo).toBe(10);
    expect(produtoSemReservaDepois.saldo_reservado).toBe(0);
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_saida: notaSemReserva.id_nota_saida },
      }),
    ).toBe(0);

    // Produto em inventário ativo bloqueia a retirada.
    const produtoInventario = await criarProduto();
    await criarEstoque(produtoInventario.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 2,
    });
    const notaInventario = await criarNotaSaida();
    const itemInventario = await criarItemNotaSaida(
      notaInventario.id_nota_saida,
      produtoInventario.id_produto,
      2,
    );
    await criarInventarioComItem(
      produtoInventario.id_produto,
      usuario.id_usuario,
    );

    await expect(
      notaSaidaService.retirar(
        notaInventario.id_nota_saida,
        [
          {
            id_item_nota_saida: itemInventario.id_item_nota_saida,
            quantidade: 1,
          },
        ],
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/inventário/);

    // O item continua intacto (a transação desfez a atualização).
    const itemInventarioDepois =
      await prismaTeste.itemNotaSaida.findUniqueOrThrow({
        where: { id_item_nota_saida: itemInventario.id_item_nota_saida },
      });
    expect(Number(itemInventarioDepois.qtd_entregue)).toBe(0);
  });

  it("nota em expedição planejada: retirada funciona, despacho e entrega respeitam o status", async () => {
    const { usuario, estoque, notaId, item } = await prepararNota({
      quantidade: 5,
    });
    const expedicao = await criarExpedicao({ status: "PLANEJADA" });
    await prismaTeste.expedicaoNota.create({
      data: {
        id_expedicao: expedicao.id_expedicao,
        id_nota_saida: notaId,
        ordem_visita: 1,
        data_adicao: new Date(),
      },
    });

    // Retirada com a nota em aberto dentro da expedição planejada.
    const retirada = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 2 }],
      usuario.id_usuario,
    );
    if ("error" in retirada) throw new Error(retirada.error);
    expect(retirada.status).toBe("BAIXA_PARCIAL");

    const despacho = await expedicaoService.despachar(
      expedicao.id_expedicao,
      usuario.id_usuario,
    );
    if ("error" in despacho) throw new Error(despacho.error);

    const notaAposDespacho = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaAposDespacho.status).toBe("BAIXA_PARCIAL");

    // A expedição registra o restante e completa a nota.
    const entrega = await expedicaoService.registrarEntrega(
      expedicao.id_expedicao,
      notaId,
      { itens: [{ id_item_nota_saida: item.id_item_nota_saida, qtd_entregue: 5 }] },
      usuario.id_usuario,
    );
    if ("error" in entrega) throw new Error(entrega.error);
    expect(entrega.entrega.status).toBe("BAIXA_TOTAL");

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(produtoDepois.saldo).toBe(5);
    expect(produtoDepois.saldo_reservado).toBe(2);
  });

  it("despachar não sobrescreve nota que já está em BAIXA_TOTAL", async () => {
    const { usuario, notaId, item } = await prepararNota({ quantidade: 2 });
    const expedicao = await criarExpedicao({ status: "PLANEJADA" });
    await prismaTeste.expedicaoNota.create({
      data: {
        id_expedicao: expedicao.id_expedicao,
        id_nota_saida: notaId,
        ordem_visita: 1,
        data_adicao: new Date(),
      },
    });

    const retirada = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 2 }],
      usuario.id_usuario,
    );
    if ("error" in retirada) throw new Error(retirada.error);
    expect(retirada.status).toBe("BAIXA_TOTAL");

    const despacho = await expedicaoService.despachar(
      expedicao.id_expedicao,
      usuario.id_usuario,
    );
    if ("error" in despacho) throw new Error(despacho.error);

    const notaDepois = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaDepois.status).toBe("BAIXA_TOTAL");
  });

  it("não entregue em nota BAIXA_PARCIAL mantém o status e a reserva", async () => {
    const { usuario, estoque, notaId, item } = await prepararNota({
      quantidade: 5,
    });
    const expedicao = await criarExpedicao({ status: "EM_PERCURSO" });
    await prismaTeste.expedicaoNota.create({
      data: {
        id_expedicao: expedicao.id_expedicao,
        id_nota_saida: notaId,
        ordem_visita: 1,
        data_adicao: new Date(),
      },
    });
    await prismaTeste.notaSaida.update({
      where: { id_nota_saida: notaId },
      data: { status: "EM_PERCURSO" },
    });

    const retirada = await notaSaidaService.retirar(
      notaId,
      [{ id_item_nota_saida: item.id_item_nota_saida, quantidade: 2 }],
      usuario.id_usuario,
    );
    if ("error" in retirada) throw new Error(retirada.error);
    expect(retirada.status).toBe("BAIXA_PARCIAL");

    const naoEntregue = await expedicaoService.marcarNaoEntregue(
      expedicao.id_expedicao,
      notaId,
      { justificativa: "Escola fechada", fotos: [] },
      usuario.id_usuario,
    );
    if ("error" in naoEntregue) throw new Error(naoEntregue.error);
    expect(naoEntregue.entrega.status).toBe("BAIXA_PARCIAL");

    const notaDepois = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(notaDepois.status).toBe("BAIXA_PARCIAL");

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(produtoDepois.saldo).toBe(8);
    expect(produtoDepois.saldo_reservado).toBe(5);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(Number(itemDepois.qtd_entregue)).toBe(2);
  });
});

describe("notaSaidaDAO.list", () => {  it("pagina as notas de saída com destinatário e itens", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario({ razaoSocial: "Escola Municipal" });

    for (let i = 0; i < 2; i++) {
      const resultado = await notaSaidaService.registrar(
        {
          tipo: "SAIDA",
          id_destinatario: destinatario.id_destinatario,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: i + 1 }],
        },
        usuario.id_usuario,
      );
      expect("error" in resultado).toBe(false);
    }

    const pagina = await notaSaidaDAO.list({ page: 1, limit: 1 });

    expect(pagina.total).toBe(2);
    expect(pagina.totalPages).toBe(2);
    expect(pagina.data).toHaveLength(1);
    expect(pagina.data[0]?.destinatario?.pessoaJuridica.razao_social).toBe("Escola Municipal");
    expect(pagina.data[0]?.itens).toHaveLength(1);
  });

  it("filtra por período (dia local), tipo, status, destinatário e urgente com busca combinada", async () => {
    const { destinatario: alfa } = await criarDestinatario({ razaoSocial: "Escola Alfa" });
    const { destinatario: beta } = await criarDestinatario({ razaoSocial: "Escola Beta" });

    // 23:30 no dia 19 local (02:30 UTC do dia 20): o filtro não pode perder.
    await criarNotaSaida({
      idDestinatario: alfa.id_destinatario,
      dataCriacao: new Date("2026-10-19T23:30:00.000-03:00"),
    });
    await criarNotaSaida({
      idDestinatario: beta.id_destinatario,
      urgente: true,
      status: "EM_PERCURSO",
      dataCriacao: new Date("2026-10-20T10:00:00.000-03:00"),
    });
    await criarNotaSaida({
      tipo: "AVARIA",
      status: "BAIXA_TOTAL",
      dataCriacao: new Date("2026-10-20T11:00:00.000-03:00"),
    });
    // Inativa: nunca aparece, mesmo casando os filtros.
    await criarNotaSaida({
      idDestinatario: alfa.id_destinatario,
      status: "CANCELADA",
      ativo: false,
      dataCriacao: new Date("2026-10-19T12:00:00.000-03:00"),
    });

    const dia19 = await notaSaidaDAO.list({ de: "2026-10-19", ate: "2026-10-19" });
    expect(dia19.total).toBe(1);

    const dia20 = await notaSaidaDAO.list({ de: "2026-10-20", ate: "2026-10-20" });
    expect(dia20.total).toBe(2);
    // A remessa aberta no dia 19 continua no dia 19, mesmo em UTC já sendo 20.
    expect(dia20.data.some((nota) => nota.tipo === "SAIDA" && nota.status === "ABERTA")).toBe(false);

    const porTipo = await notaSaidaDAO.list({ tipos: ["AVARIA"] });
    expect(porTipo.total).toBe(1);
    expect(porTipo.data[0]?.tipo).toBe("AVARIA");

    const porStatus = await notaSaidaDAO.list({ status: ["EM_PERCURSO", "BAIXA_TOTAL"] });
    expect(porStatus.total).toBe(2);

    const porDestinatario = await notaSaidaDAO.list({
      id_destinatario: [alfa.id_destinatario],
    });
    expect(porDestinatario.total).toBe(1);
    expect(porDestinatario.data[0]?.id_destinatario).toBe(alfa.id_destinatario);

    const urgentes = await notaSaidaDAO.list({ urgente: true });
    expect(urgentes.total).toBe(1);
    expect(urgentes.data[0]?.urgente).toBe(true);

    const busca = await notaSaidaDAO.list({ search: "Beta" });
    expect(busca.total).toBe(1);
    expect(busca.data[0]?.id_destinatario).toBe(beta.id_destinatario);

    // Busca e filtro de domínio valem juntos (AND), sem um sobrescrever o outro.
    const combinado = await notaSaidaDAO.list({ search: "Beta", tipos: ["AVARIA"] });
    expect(combinado.total).toBe(0);

    // Sem filtro, o resultado é o mesmo de antes (todas as notas ativas).
    const semFiltro = await notaSaidaDAO.list();
    expect(semFiltro.total).toBe(3);
  });
});

describe("saída sem remessa (avaria e consumo interno)", () => {
  it.each(["AVARIA", "CONSUMO_INTERNO"] as const)(
    "%s baixa o estoque na criação, sem reserva e sem destinatário",
    async (tipo) => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, {
        quantidadeAtual: 10,
        saldoReservado: 2,
      });

      const resultado = await notaSaidaService.registrar(
        {
          tipo,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 4 }],
        },
        usuario.id_usuario,
      );

      expect("error" in resultado).toBe(false);
      if ("error" in resultado) return;
      expect(resultado.aviso).toBeNull();

      const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
        where: { id_nota_saida: resultado.nota.id_nota_saida },
        include: { itens: true, reservas: true, movimentacoes: true },
      });
      expect(nota.tipo).toBe(tipo);
      expect(nota.status).toBe("BAIXA_TOTAL");
      expect(nota.id_destinatario).toBeNull();
      expect(nota.urgente).toBe(false);
      expect(nota.reservas).toHaveLength(0);
      expect(nota.itens).toHaveLength(1);
      expect(nota.itens[0]).toMatchObject({
        id_produto: estoque.id_produto,
        qtd_esperada: 4,
        qtd_entregue: 4,
      });
      expect(nota.movimentacoes).toHaveLength(1);
      expect(nota.movimentacoes[0]).toMatchObject({
        id_produto: estoque.id_produto,
        id_nota_saida: nota.id_nota_saida,
        quantidade: -4,
        saldo_anterior: 10,
        saldo_posterior: 6,
      });

      const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: estoque.id_produto },
      });
      expect(estoqueApos.saldo).toBe(6);
      expect(estoqueApos.saldo_reservado).toBe(2);

      const auditorias = await auditoriasDe("NotaSaida", nota.id_nota_saida);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.dados_novos).toMatchObject({
        tipo,
        status: "BAIXA_TOTAL",
        id_destinatario: null,
        itens: [
          {
            id_produto: produto.id_produto,
            quantidade_solicitada: 4,
            quantidade_entregue: 4,
          },
        ],
        movimentacoes: [
          {
            id_produto: estoque.id_produto,
            quantidade: -4,
            saldo_anterior: 10,
            saldo_posterior: 6,
          },
        ],
      });
    },
  );

  it("RN001: avaria acima do saldo avisa e grava com saldo negativa", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 2,
      saldoReservado: 1,
    });

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "AVARIA",
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 5 }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;
    expect(resultado.aviso).toContain("Saldo insuficiente");

    const estoqueApos = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: estoque.id_produto },
    });
    expect(estoqueApos.saldo).toBe(-3);
    expect(estoqueApos.saldo_reservado).toBe(1);

    const movimentacao = await prismaTeste.movimentacaoEstoque.findFirstOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
    });
    expect(movimentacao).toMatchObject({
      quantidade: -5,
      saldo_anterior: 2,
      saldo_posterior: -3,
    });
  });

  it("recusa DESMONTAGEM e tipo desconhecido sem gravar nada", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });

    const desmontagem = await notaSaidaService.registrar(
      {
        tipo: "DESMONTAGEM" as never,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );
    const desconhecido = await notaSaidaService.registrar(
      {
        tipo: "OUTRO" as never,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );

    expect(desmontagem).toEqual({ error: "Tipo de saída inválido." });
    expect(desconhecido).toEqual({ error: "Tipo de saída inválido." });
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("RN001: Avaria sem saldo avisa e grava com saldo negativo", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaSaidaService.registrar(
      {
        tipo: "CONSUMO_INTERNO",
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;
    expect(resultado.aviso).toContain("Saldo insuficiente");

    const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(produtoDepois.saldo).toBe(-2);
    expect(await prismaTeste.notaSaida.count()).toBe(1);
    expect(await prismaTeste.itemNotaSaida.count()).toBe(1);
    expect(await prismaTeste.movimentacaoEstoque.count()).toBe(1);
  });

  it("lista todos os tipos ativos com o tipo no retorno", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
    const { destinatario } = await criarDestinatario();

    const remessa = await notaSaidaService.registrar(
      {
        tipo: "SAIDA",
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );
    expect("error" in remessa).toBe(false);

    const avaria = await notaSaidaService.registrar(
      {
        tipo: "AVARIA",
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );
    expect("error" in avaria).toBe(false);

    const pagina = await notaSaidaDAO.list();
    expect(pagina.total).toBe(2);
    expect(new Set(pagina.data.map((nota) => nota.tipo))).toEqual(
      new Set(["SAIDA", "AVARIA"]),
    );
    expect(pagina.data.find((nota) => nota.tipo === "AVARIA")?.destinatario).toBeNull();
  });
});
