import { describe, expect, it, vi } from "vitest";
import { criarProduto, criarUsuario } from "../helpers/factories";
import { notaEntradaService } from "@/services/nota-entrada";
import { prismaTeste } from "../helpers/prisma";

/**
 * O servidor é a barreira de permissão das Server Actions. Aqui a sessão e a
 * lista de permissões são controladas para provar a recusa sem
 * `nota_entrada.alterar` (e a leitura com `nota_entrada.consultar`).
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

import { obterNotaEntrada, salvarNotaEntrada } from "@/app/mov-estoque/actions";

describe("actions da nota de entrada", () => {
  async function prepararNota(nomes: string[]) {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = nomes;

    const produto = await criarProduto();
    const resultado = await notaEntradaService.registrar(
      { itens: [{ id_produto: produto.id_produto, fator_conversao: 1, quantidade: 5 }] },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) throw new Error(resultado.error);

    const nota = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.nota.id_nota_entrada },
      include: { itens: true },
    });

    return { usuario, produto, nota, item: nota.itens[0]! };
  }

  it("recusa a edição no servidor sem nota_entrada.alterar", async () => {
    const { usuario, produto, nota, item } = await prepararNota(["estoque.entrada"]);

    const resultado = await salvarNotaEntrada(nota.id_nota_entrada, {
      itens: [
        {
          id_item_nota_entrada: item.id_item_nota_entrada,
          id_produto: produto.id_produto,
          fator_conversao: 1,
          quantidade: 9,
        },
      ],
    });

    expect(resultado).toEqual({ error: "Sem permissão." });

    const estoque = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoque.quantidade_atual).toBe(5);
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_entrada: nota.id_nota_entrada },
      }),
    ).toBe(1);

    const itemDepois = await prismaTeste.itemNotaEntrada.findUniqueOrThrow({
      where: { id_item_nota_entrada: item.id_item_nota_entrada },
    });
    expect(itemDepois.quantidade).toBe(5);
    expect(usuario.id_usuario).toBe(sessao.id_usuario);
  });

  it("salva a edição com nota_entrada.alterar", async () => {
    const { produto, nota, item } = await prepararNota(["nota_entrada.alterar"]);

    const resultado = await salvarNotaEntrada(nota.id_nota_entrada, {
      itens: [
        {
          id_item_nota_entrada: item.id_item_nota_entrada,
          id_produto: produto.id_produto,
          fator_conversao: 1,
          quantidade: 7,
        },
      ],
    });

    expect(resultado).toEqual({
      success: true,
      id_nota_entrada: nota.id_nota_entrada,
    });

    const estoque = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoque.quantidade_atual).toBe(7);
  });

  it("só entrega o detalhe com nota_entrada.consultar", async () => {
    const { nota } = await prepararNota(["estoque.entrada"]);
    expect(await obterNotaEntrada(nota.id_nota_entrada, "view")).toBeNull();

    permissoes.nomes = ["nota_entrada.consultar"];
    const detalhe = await obterNotaEntrada(nota.id_nota_entrada, "view");
    expect(detalhe?.id_nota_entrada).toBe(nota.id_nota_entrada);
    expect(detalhe?.itens).toHaveLength(1);
  });
});
