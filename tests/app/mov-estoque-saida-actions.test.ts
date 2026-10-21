import { describe, expect, it, vi } from "vitest";
import {
  criarDestinatario,
  criarEstoque,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { notaSaidaService } from "@/services/nota-saida";
import { prismaTeste } from "../helpers/prisma";

/**
 * O servidor é a barreira de permissão das Server Actions da saída. A sessão e
 * as permissões são controladas para provar a recusa sem
 * `remessa.alterar`/`nota_saida.alterar` e a leitura com `.consultar`.
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
  obterNotaSaida,
  obterRemessa,
  salvarNotaSaida,
  salvarRemessa,
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
        observacao: "observação original",
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 3 }],
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

  it("só entrega o detalhe da remessa com remessa.consultar", async () => {
    const { notaId, remessaId } = await prepararSaida(["estoque.saida"]);
    expect(await obterRemessa(remessaId, "view")).toBeNull();

    permissoes.nomes = ["remessa.consultar"];
    const detalhe = await obterRemessa(remessaId, "view");
    expect(detalhe?.id_remessa).toBe(remessaId);
    expect(detalhe?.itens).toHaveLength(1);
    expect(detalhe?.destinatario).toBeTruthy();
    expect(detalhe?.podeEditar).toBe(true);
    expect(detalhe?.id_nota_saida).toBe(notaId);
  });

  it("recusa a edição da remessa no servidor sem remessa.alterar", async () => {
    const { produto, destinatario, remessaId, item } = await prepararSaida([
      "remessa.consultar",
    ]);

    const resultado = await salvarRemessa(remessaId, {
      id_destinatario: destinatario.id_destinatario,
      itens: [
        {
          id_item_remessa: item.id_item_remessa,
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
    expect(await prismaTeste.reservaEstoque.count({ where: { id_remessa: remessaId } })).toBe(1);

    const itemDepois = await prismaTeste.itemRemessa.findUniqueOrThrow({
      where: { id_item_remessa: item.id_item_remessa },
    });
    expect(itemDepois.quantidade_solicitada).toBe(3);
  });

  it("salva a edição da remessa com remessa.alterar", async () => {
    const { produto, destinatario, remessaId, item } = await prepararSaida([
      "remessa.alterar",
    ]);

    const resultado = await salvarRemessa(remessaId, {
      id_destinatario: destinatario.id_destinatario,
      itens: [
        {
          id_item_remessa: item.id_item_remessa,
          id_produto: produto.id_produto,
          quantidade_solicitada: 6,
        },
      ],
    });

    expect(resultado).toEqual({ success: true, id_remessa: remessaId });

    const estoqueApos = await prismaTeste.estoque.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    expect(estoqueApos.saldo_reservado).toBe(8);
  });

  it("só entrega o detalhe da nota com nota_saida.consultar", async () => {
    const { notaId } = await prepararSaida(["estoque.saida"]);
    expect(await obterNotaSaida(notaId, "view")).toBeNull();

    permissoes.nomes = ["nota_saida.consultar"];
    const detalhe = await obterNotaSaida(notaId, "view");
    expect(detalhe?.id_nota_saida).toBe(notaId);
    expect(detalhe?.remessas).toHaveLength(1);
    expect(detalhe?.remessas[0]?.itens).toHaveLength(1);
  });

  it("recusa editar a nota sem nota_saida.alterar", async () => {
    const { notaId } = await prepararSaida(["nota_saida.consultar"]);

    const resultado = await salvarNotaSaida(notaId, { observacao: "nova" });
    expect(resultado).toEqual({ error: "Sem permissão." });

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.observacao).toBe("observação original");
  });

  it("salva a observação da nota com nota_saida.alterar", async () => {
    const { notaId } = await prepararSaida(["nota_saida.alterar"]);

    const resultado = await salvarNotaSaida(notaId, { observacao: "nova observação" });
    expect(resultado).toEqual({ success: true, id_nota_saida: notaId });

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaId },
    });
    expect(nota.observacao).toBe("nova observação");
  });
});
