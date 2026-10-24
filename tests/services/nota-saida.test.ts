import { describe, expect, it } from "vitest";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { notaSaidaService } from "@/services/nota-saida";
import {
  criarDestinatario,
  criarEstoque,
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
      id_estoque: estoque.id_estoque,
      qtd_esperada: 3,
    });

    expect(nota.reservas).toHaveLength(1);
    expect(nota.reservas[0]).toMatchObject({
      id_estoque: estoque.id_estoque,
      id_nota_saida: nota.id_nota_saida,
      id_usuario: usuario.id_usuario,
      quantidade: 3,
      saldo_anterior: 2,
      saldo_posterior: 5,
    });

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(estoqueApos.quantidade_atual).toBe(10);
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

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(Number(estoqueApos.quantidade_atual) - Number(estoqueApos.saldo_reservado)).toBe(-3);
  });

  it("cria a linha de estoque com quantidade_atual 0 quando o produto não tem estoque", async () => {
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

    const linhas = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ quantidade_atual: 0, saldo_reservado: 4, ativo: true });
  });

  it("reativa a linha inativa do produto em vez de criar outra", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const inativa = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 8,
      ativo: false,
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

    const linhas = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id_estoque: inativa.id_estoque,
      ativo: true,
      quantidade_atual: 8,
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
    expect(await prismaTeste.estoque.count()).toBe(0);
    expect(await prismaTeste.registroAuditoria.count({ where: { entidade: "NotaSaida" } })).toBe(0);
  });
});

describe("notaSaidaService.atualizar", () => {
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

    const estoqueDepois = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
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
      id_estoque: estoque.id_estoque,
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

    const estoqueDepois = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
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

    const estoqueB = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produtoB.id_produto },
    });
    expect(estoqueB.saldo_reservado).toBe(4);
    expect(itens[1]?.id_estoque).toBe(estoqueB.id_estoque);

    const reservaB = await prismaTeste.reservaEstoque.findFirstOrThrow({
      where: { id_estoque: estoqueB.id_estoque },
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
      where: { id_estoque: estoque.id_estoque },
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

      const estoqueDepois = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
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

    const estoqueDepois = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
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

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(2);
    expect(estoqueApos.quantidade_atual).toBe(10);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: notaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      id_estoque: estoque.id_estoque,
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

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
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

      const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
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

describe("notaSaidaDAO.list", () => {
  it("pagina as notas de saída com destinatário e itens", async () => {
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
        id_estoque: estoque.id_estoque,
        qtd_esperada: 4,
        qtd_entregue: 4,
      });
      expect(nota.movimentacoes).toHaveLength(1);
      expect(nota.movimentacoes[0]).toMatchObject({
        id_estoque: estoque.id_estoque,
        id_nota_saida: nota.id_nota_saida,
        quantidade: -4,
        saldo_anterior: 10,
        saldo_posterior: 6,
      });

      const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
      });
      expect(estoqueApos.quantidade_atual).toBe(6);
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
            id_estoque: estoque.id_estoque,
            id_produto: produto.id_produto,
            quantidade_solicitada: 4,
            quantidade_entregue: 4,
          },
        ],
        movimentacoes: [
          {
            id_estoque: estoque.id_estoque,
            quantidade: -4,
            saldo_anterior: 10,
            saldo_posterior: 6,
          },
        ],
      });
    },
  );

  it("RN001: avaria acima do saldo avisa e grava com quantidade_atual negativa", async () => {
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

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.quantidade_atual).toBe(-3);
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

  it("desfaz tudo quando o produto não tem estoque ativo", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    await expect(
      notaSaidaService.registrar(
        {
          tipo: "CONSUMO_INTERNO",
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/estoque ativo/);

    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.itemNotaSaida.count()).toBe(0);
    expect(await prismaTeste.movimentacaoEstoque.count()).toBe(0);
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
