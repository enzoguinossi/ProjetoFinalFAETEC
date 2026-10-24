import { describe, expect, it, vi } from "vitest";
import { criarDestinatario, criarEstoque, criarProduto, criarUsuario } from "../helpers/factories";
import { notaSaidaService } from "@/services/nota-saida";
import { prismaTeste } from "../helpers/prisma";

/**
 * O servidor é a barreira de permissão das Server Actions da saída. A sessão e
 * as permissões são controladas para provar a recusa sem
 * `nota_saida.*` e a leitura com `.consultar`.
 */
const sessao = vi.hoisted(() => ({ id_usuario: 0 }));
const permissoes = vi.hoisted(() => ({ nomes: [] as string[] }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    id_usuario: sessao.id_usuario,
    super_admin: false,
  }),
}));

vi.mock("@/services/permissao", () => ({
  permissaoService: {
    listarPorUsuario: async () => permissoes.nomes,
  },
}));

import {
  atualizarNotaSaida,
  cancelarNotaSaida,
  criarNotaSaida,
  obterNotaSaida,
} from "@/app/mov-estoque/actions";

describe("actions da nota de saída", () => {
  async function prepararSaida(nomes: string[]) {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = nomes;

    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 2,
    });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        id_destinatario: destinatario.id_destinatario,
        observacao: "observação original",
        itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 3 }],
      },
      usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
      include: { itens: true },
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

  it("só entrega o detalhe da nota com nota_saida.consultar", async () => {
    const { notaId } = await prepararSaida(["estoque.saida"]);
    expect(await obterNotaSaida(notaId, "view")).toBeNull();

    permissoes.nomes = ["nota_saida.consultar"];
    const detalhe = await obterNotaSaida(notaId, "view");
    expect(detalhe?.id_nota_saida).toBe(notaId);
    expect(detalhe?.destinatario).toBeTruthy();
    expect(detalhe?.itens).toHaveLength(1);
    expect(detalhe?.podeEditar).toBe(true);
  });

  it("recusa a edição da nota no servidor sem nota_saida.alterar", async () => {
    const { produto, destinatario, notaId, item } = await prepararSaida([
      "nota_saida.consultar",
    ]);

    const resultado = await atualizarNotaSaida(notaId, {
      id_destinatario: destinatario.id_destinatario,
      itens: [
        {
          id_item_nota_saida: item.id_item_nota_saida,
          id_produto: produto.id_produto,
          quantidade_solicitada: 9,
        },
      ],
    });

    expect(resultado).toEqual({ error: "Sem permissão." });

    const estoqueApos = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(await prismaTeste.reservaEstoque.count({ where: { id_nota_saida: notaId } })).toBe(1);

    const itemDepois = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: item.id_item_nota_saida },
    });
    expect(itemDepois.qtd_esperada).toBe(3);
  });

  it("salva a edição da nota com nota_saida.alterar", async () => {
    const { produto, destinatario, notaId, item } = await prepararSaida([
      "nota_saida.alterar",
    ]);

    const resultado = await atualizarNotaSaida(notaId, {
      id_destinatario: destinatario.id_destinatario,
      observacao: "nova observação",
      itens: [
        {
          id_item_nota_saida: item.id_item_nota_saida,
          id_produto: produto.id_produto,
          quantidade_solicitada: 6,
        },
      ],
    });

    expect(resultado).toEqual({ success: true, id_nota_saida: notaId });

    const estoqueApos = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(8);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.observacao).toBe("nova observação");
  });

  it("recusa criar a saída sem nota_saida.criar", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.saida"];

    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await criarNotaSaida({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
    });

    expect(resultado).toEqual({ error: "Sem permissão." });
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("cria a saída com nota_saida.criar", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["nota_saida.criar"];

    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await criarNotaSaida({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
    });

    expect(resultado).toMatchObject({ success: true });
    expect(await prismaTeste.notaSaida.count()).toBe(1);
  });

  it("recusa cancelar sem nota_saida.cancelar", async () => {
    const { notaId } = await prepararSaida(["nota_saida.alterar"]);

    const resultado = await cancelarNotaSaida(notaId);

    expect(resultado).toEqual({ error: "Sem permissão." });
    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.status).toBe("ABERTA");
  });

  it("cancela a nota com nota_saida.cancelar", async () => {
    const { notaId } = await prepararSaida(["nota_saida.cancelar"]);

    const resultado = await cancelarNotaSaida(notaId);

    expect(resultado).toEqual({ success: true, id_nota_saida: notaId });
    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.status).toBe("CANCELADA");
  });
});
