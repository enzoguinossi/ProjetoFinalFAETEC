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

async function criarRemessaComReserva(quantidade = 3) {
  const { usuario } = await criarUsuario();
  const produto = await criarProduto();
  const estoque = await criarEstoque(produto.id_produto, {
    quantidadeAtual: 10,
    saldoReservado: 2,
  });
  const { destinatario } = await criarDestinatario();

  const resultado = await notaSaidaService.registrar(
    {
      remessas: [
        {
          id_destinatario: destinatario.id_destinatario,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: quantidade }],
        },
      ],
    },
    usuario.id_usuario,
  );
  if ("error" in resultado) throw new Error(resultado.error);

  return {
    usuario,
    produto,
    estoque,
    remessaId: resultado.remessas[0]!.id_remessa,
    notaId: resultado.nota.id_nota_saida,
  };
}

describe("notaSaidaService.cancelarRemessa", () => {
  it("cancela uma remessa EM_PREPARACAO e devolve o saldo_reservado ao valor anterior", async () => {
    const { usuario, estoque, remessaId } = await criarRemessaComReserva(3);

    const cancelamento = await notaSaidaService.cancelarRemessa(remessaId, usuario.id_usuario);

    expect("error" in cancelamento).toBe(false);

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(2);
    expect(estoqueApos.quantidade_atual).toBe(10);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_remessa: remessaId },
      orderBy: { id_reserva_estoque: "asc" },
    });
    expect(reservas).toHaveLength(2);
    expect(reservas[1]).toMatchObject({
      id_estoque: estoque.id_estoque,
      id_remessa: remessaId,
      id_usuario: usuario.id_usuario,
      quantidade: -3,
      saldo_anterior: 5,
      saldo_posterior: 2,
    });

    // A remessa não é apagada (RN004).
    const remessaApos = await prismaTeste.remessa.findUniqueOrThrow({
      where: { id_remessa: remessaId },
    });
    expect(remessaApos.status).toBe("CANCELADA");

    const auditorias = await auditoriasDe("Remessa", remessaId);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("ALTERAR");
    expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
    expect(auditorias[0]?.dados_anteriores).toMatchObject({
      id_remessa: remessaId,
      status: "EM_PREPARACAO",
    });
    expect(auditorias[0]?.dados_novos).toMatchObject({
      id_remessa: remessaId,
      status: "CANCELADA",
    });
  });

  it("aceita cancelar remessa PRONTO_PARA_ENTREGA", async () => {
    const { usuario, remessaId } = await criarRemessaComReserva(2);
    await prismaTeste.remessa.update({
      where: { id_remessa: remessaId },
      data: { status: "PRONTO_PARA_ENTREGA" },
    });

    const cancelamento = await notaSaidaService.cancelarRemessa(remessaId, usuario.id_usuario);

    expect("error" in cancelamento).toBe(false);
    const remessaApos = await prismaTeste.remessa.findUniqueOrThrow({
      where: { id_remessa: remessaId },
    });
    expect(remessaApos.status).toBe("CANCELADA");
  });

  it("recusa o segundo cancelamento e não debita a reserva outra vez", async () => {
    const { usuario, estoque, remessaId } = await criarRemessaComReserva(3);

    const primeiro = await notaSaidaService.cancelarRemessa(remessaId, usuario.id_usuario);
    expect("error" in primeiro).toBe(false);

    const segundo = await notaSaidaService.cancelarRemessa(remessaId, usuario.id_usuario);
    expect("error" in segundo).toBe(true);
    if ("error" in segundo) expect(segundo.error).toContain("já está cancelada");

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(2);

    const reservas = await prismaTeste.reservaEstoque.findMany({
      where: { id_remessa: remessaId },
    });
    expect(reservas).toHaveLength(2);
  });

  it.each(["EM_PERCURSO", "FINALIZADO_TOTAL"] as const)(
    "recusa cancelar remessa %s sem alterar a reserva",
    async (status) => {
      const { usuario, estoque, remessaId } = await criarRemessaComReserva(3);
      await prismaTeste.remessa.update({
        where: { id_remessa: remessaId },
        data: { status },
      });

      const cancelamento = await notaSaidaService.cancelarRemessa(remessaId, usuario.id_usuario);

      expect("error" in cancelamento).toBe(true);
      if ("error" in cancelamento) expect(cancelamento.error).toContain("não pode ser cancelada");

      const remessaApos = await prismaTeste.remessa.findUniqueOrThrow({
        where: { id_remessa: remessaId },
      });
      expect(remessaApos.status).toBe(status);

      const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
        where: { id_estoque: estoque.id_estoque },
      });
      expect(estoqueApos.saldo_reservado).toBe(5);

      expect(await prismaTeste.reservaEstoque.count({ where: { id_remessa: remessaId } })).toBe(1);
      expect(await auditoriasDe("Remessa", remessaId)).toHaveLength(0);
    },
  );

  it("recusa remessa inexistente", async () => {
    const { usuario } = await criarUsuario();

    const cancelamento = await notaSaidaService.cancelarRemessa(999999, usuario.id_usuario);

    expect("error" in cancelamento).toBe(true);
    expect(await prismaTeste.remessa.count()).toBe(0);
  });
});
