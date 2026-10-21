import { describe, expect, it } from "vitest";
import { notaSaidaService } from "@/services/nota-saida";
import {
  criarDestinatario,
  criarEstoque,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

/** Nota com uma remessa de um item (`quantidade` solicitada) e reserva já feita. */
async function prepararRemessa(
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
      remessas: [
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: opts.quantidade ?? 3 }],
        },
      ],
    },
    usuario.id_usuario,
  );
  if ("error" in resultado) throw new Error(resultado.error);

  const remessaId = resultado.remessas[0]!.id_remessa;
  const remessa = await prismaTeste.remessa.findUniqueOrThrow({
    where: { id_remessa: remessaId },
    include: { itens: true },
  });

  return {
    usuario,
    produto,
    estoque,
    destinatario,
    remessaId,
    notaId: resultado.nota.id_nota_saida,
    item: remessa.itens[0]!,
  };
}

describe("notaSaidaService.atualizarRemessa", () => {
  it("aumenta a quantidade solicitada e ajusta a reserva pelo delta", async () => {
    const { usuario, produto, estoque, destinatario, remessaId, item } =
      await prepararRemessa({ quantidade: 3 });

    const resultado = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        observacao: "Correção da quantidade",
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
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
    expect(estoqueDepois.quantidade_atual).toBe(10);

    const itemDepois = await prismaTeste.itemRemessa.findUniqueOrThrow({
      where: { id_item_remessa: item.id_item_remessa },
    });
    expect(itemDepois.quantidade_solicitada).toBe(8);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_remessa: remessaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      id_estoque: estoque.id_estoque,
      id_remessa: remessaId,
      id_usuario: usuario.id_usuario,
      quantidade: 5,
      saldo_anterior: 5,
      saldo_posterior: 10,
    });

    const remessaDepois = await prismaTeste.remessa.findUniqueOrThrow({
      where: { id_remessa: remessaId },
    });
    expect(remessaDepois.observacao).toBe("Correção da quantidade");

    const auditorias = await auditoriasDe("Remessa", remessaId);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("ALTERAR");
    expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[0]?.dados_anteriores).toMatchObject({
      itens: [{ id_item_remessa: item.id_item_remessa, quantidade_solicitada: 3 }],
    });
    expect(auditorias[0]?.dados_novos).toMatchObject({
      itens: [{ id_item_remessa: item.id_item_remessa, quantidade_solicitada: 8 }],
    });
  });

  it("diminui a quantidade solicitada e devolve a reserva pelo delta negativo", async () => {
    const { usuario, produto, estoque, destinatario, remessaId, item } =
      await prepararRemessa({ quantidade: 3 });

    const resultado = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
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
      where: { id_remessa: remessaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      quantidade: -2,
      saldo_anterior: 5,
      saldo_posterior: 3,
    });

    const itemDepois = await prismaTeste.itemRemessa.findUniqueOrThrow({
      where: { id_item_remessa: item.id_item_remessa },
    });
    expect(itemDepois.quantidade_solicitada).toBe(1);
  });

  it("acrescenta item novo e reserva o valor cheio", async () => {
    const { usuario, produto, estoque, destinatario, remessaId, item } =
      await prepararRemessa({ quantidade: 3 });
    const produtoB = await criarProduto();

    const resultado = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 4 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);

    const itens = await prismaTeste.itemRemessa.findMany({
      where: { id_remessa: remessaId },
      orderBy: { id_item_remessa: "asc" },
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
      id_remessa: remessaId,
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

  it.each(["FINALIZADO_TOTAL", "FINALIZADO_PARCIAL", "CANCELADA", "EM_PERCURSO"] as const)(
    "recusa editar remessa %s sem alterar reserva nem histórico",
    async (status) => {
      const { usuario, produto, estoque, destinatario, remessaId, item } =
        await prepararRemessa({ quantidade: 3 });
      await prismaTeste.remessa.update({
        where: { id_remessa: remessaId },
        data: { status },
      });

      const resultado = await notaSaidaService.atualizarRemessa(
        remessaId,
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [
            {
              id_item_remessa: item.id_item_remessa,
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

      const itemDepois = await prismaTeste.itemRemessa.findUniqueOrThrow({
        where: { id_item_remessa: item.id_item_remessa },
      });
      expect(itemDepois.quantidade_solicitada).toBe(3);

      expect(await prismaTeste.reservaEstoque.count({ where: { id_remessa: remessaId } })).toBe(1);
      expect(await auditoriasDe("Remessa", remessaId)).toHaveLength(0);
    },
  );

  it("recusa remover item de uma remessa", async () => {
    const { usuario, produto, destinatario, remessaId, item } = await prepararRemessa({
      quantidade: 3,
    });
    const produtoB = await criarProduto();

    const comDois = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
          { id_produto: produtoB.id_produto, quantidade_solicitada: 2 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in comDois).toBe(false);

    const resultado = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
            id_produto: produto.id_produto,
            quantidade_solicitada: 3,
          },
        ],
      },
      usuario.id_usuario,
    );

    expect(resultado).toEqual({
      error: "Não é possível remover itens de uma remessa.",
    });
    expect(await prismaTeste.itemRemessa.count({ where: { id_remessa: remessaId } })).toBe(2);
  });

  it("recusa quantidade inválida e remessa inexistente", async () => {
    const { usuario, produto, destinatario, remessaId, item } = await prepararRemessa();

    const quantidadeInvalida = await notaSaidaService.atualizarRemessa(
      remessaId,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [
          {
            id_item_remessa: item.id_item_remessa,
            id_produto: produto.id_produto,
            quantidade_solicitada: 0,
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in quantidadeInvalida).toBe(true);

    const inexistente = await notaSaidaService.atualizarRemessa(
      999999,
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
      },
      usuario.id_usuario,
    );
    expect(inexistente).toEqual({ error: "Remessa não encontrada." });
  });

  it("desfaz tudo quando um item novo viola a integridade do banco", async () => {
    const { usuario, produto, estoque, destinatario, remessaId, item } =
      await prepararRemessa({ quantidade: 3 });

    await expect(
      notaSaidaService.atualizarRemessa(
        remessaId,
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [
            {
              id_item_remessa: item.id_item_remessa,
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

    const itemDepois = await prismaTeste.itemRemessa.findUniqueOrThrow({
      where: { id_item_remessa: item.id_item_remessa },
    });
    expect(itemDepois.quantidade_solicitada).toBe(3);

    // Só a reserva da criação; nenhuma auditoria de edição.
    expect(await prismaTeste.reservaEstoque.count({ where: { id_remessa: remessaId } })).toBe(1);
    expect(await auditoriasDe("Remessa", remessaId)).toHaveLength(0);
  });
});

describe("notaSaidaService.atualizarNotaSaida", () => {
  it("edita apenas a observação da nota e grava auditoria", async () => {
    const { usuario, destinatario, remessaId, notaId } = await prepararRemessa({
      quantidade: 3,
    });

    const resultado = await notaSaidaService.atualizarNotaSaida(
      notaId,
      { observacao: "  Separar por escola  " },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.observacao).toBe("Separar por escola");

    // CRIAR da nota + ALTERAR da edição.
    const auditorias = await auditoriasDe("NotaSaida", notaId);
    expect(auditorias).toHaveLength(2);
    expect(auditorias[1]?.acao).toBe("ALTERAR");
    expect(auditorias[1]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[1]?.dados_anteriores).toMatchObject({ observacao: null });
    expect(auditorias[1]?.dados_novos).toMatchObject({ observacao: "Separar por escola" });

    // A edição da nota não mexe nas remessas nem na reserva.
    const remessa = await prismaTeste.remessa.findUniqueOrThrow({
      where: { id_remessa: remessaId },
    });
    expect(remessa.id_destinatario).toBe(destinatario.id_destinatario);
    expect(await prismaTeste.reservaEstoque.count({ where: { id_remessa: remessaId } })).toBe(1);
  });

  it("recusa nota de saída inexistente", async () => {
    const { usuario } = await criarUsuario();

    await expect(
      notaSaidaService.atualizarNotaSaida(999999, { observacao: "x" }, usuario.id_usuario),
    ).rejects.toThrow("Nota de saída não encontrada.");
  });
});
