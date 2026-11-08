import { describe, expect, it, vi } from "vitest";
import { criarDestinatario, criarProduto, criarUsuario } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

/**
 * O servidor é a barreira de permissão das Server Actions de pedidos: a sessão
 * e as permissões são controladas para provar a recusa sem `pedido.*` e a
 * aceitação com a permissão da ação.
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
  aprovarPedido,
  atualizarPedido,
  criarPedido,
  listarEscolasSelecao,
  listarPedidos,
  listarProdutosPedido,
  obterPedido,
  recusarPedido,
} from "@/app/pedidos/actions";
import {
  listarPedidosParaImportacao,
  obterPedidoParaImportacao,
  importarPedidoParaSaida,
} from "@/app/mov-estoque/actions";
import { pedidoService } from "@/services/pedido";

async function preparar(nomes: string[]) {
  const { usuario } = await criarUsuario();
  sessao.id_usuario = usuario.id_usuario;
  permissoes.nomes = nomes;

  const { destinatario } = await criarDestinatario();
  const produto = await criarProduto();
  return { usuario, destinatario, produto };
}

describe("actions de pedidos — permissões", () => {
  it("sem pedido.* não lista, não cria, não consulta e não analisa", async () => {
    const { destinatario, produto } = await preparar([]);

    const lista = await listarPedidos({ page: 1 });
    expect(lista.total).toBe(0);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
    });
    expect(criado).toEqual({ error: "Sem permissão." });

    expect(await obterPedido(1)).toBeNull();
    expect(await listarEscolasSelecao()).toEqual([]);
    expect(await listarProdutosPedido()).toEqual([]);
    expect(await aprovarPedido(1)).toEqual({ error: "Sem permissão." });
    expect(await recusarPedido(1)).toEqual({ error: "Sem permissão." });

    // A importação na Saída usa `nota_saida.criar`, não `pedido.*`.
    expect(await listarPedidosParaImportacao()).toEqual([]);
    expect(await obterPedidoParaImportacao(1)).toBeNull();
  });

  it("pedido.criar cria, mas não aprova", async () => {
    const { destinatario, produto } = await preparar(["pedido.criar"]);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 2 }],
    });
    if ("error" in criado) throw new Error(criado.error);

    expect(criado.success).toBe(true);
    expect(await prismaTeste.pedidoEscola.count()).toBe(1);
    expect(await aprovarPedido(criado.id_pedido_escola)).toEqual({
      error: "Sem permissão.",
    });
  });

  it("pedido.alterar edita pendente; pedido.aprovar analisa", async () => {
    const { destinatario, produto } = await preparar([
      "pedido.criar",
      "pedido.listar",
      "pedido.alterar",
      "pedido.aprovar",
    ]);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
    });
    if ("error" in criado) throw new Error(criado.error);

    const lista = await listarPedidos({ page: 1 });
    expect(lista.total).toBe(1);

    const editado = await atualizarPedido(criado.id_pedido_escola, {
      id_destinatario: destinatario.id_destinatario,
      observacao: "editado",
      itens: [{ id_produto: produto.id_produto, quantidade: 4 }],
    });
    expect("error" in editado).toBe(false);

    const aprovado = await aprovarPedido(criado.id_pedido_escola);
    expect(aprovado).toEqual({ success: true });

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: criado.id_pedido_escola },
      include: { itens: true },
    });
    expect(pedido.status).toBe("CONFIRMADO");
    expect(Number(pedido.itens[0]!.quantidade)).toBe(4);

    const detalhe = await obterPedido(criado.id_pedido_escola);
    expect(detalhe?.status).toBe("CONFIRMADO");
  });

  it("nota_saida.criar enxerga o pedido aprovado para importar", async () => {
    const { destinatario, produto } = await preparar([
      "pedido.criar",
      "pedido.aprovar",
      "nota_saida.criar",
    ]);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 3 }],
    });
    if ("error" in criado) throw new Error(criado.error);
    await aprovarPedido(criado.id_pedido_escola);

    const importaveis = await listarPedidosParaImportacao();
    expect(importaveis).toHaveLength(1);
    expect(importaveis[0]!.id_pedido_escola).toBe(criado.id_pedido_escola);

    const detalhe = await obterPedidoParaImportacao(criado.id_pedido_escola);
    expect(detalhe?.itens[0]!.quantidade).toBe(3);
    expect(detalhe?.id_destinatario).toBe(destinatario.id_destinatario);
  });

  it("importa pelo serviço do pedido e tira da lista (uma nota por pedido)", async () => {
    const { destinatario, produto } = await preparar([
      "pedido.criar",
      "pedido.aprovar",
      "nota_saida.criar",
    ]);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 3 }],
    });
    if ("error" in criado) throw new Error(criado.error);
    await aprovarPedido(criado.id_pedido_escola);

    const importado = await importarPedidoParaSaida(criado.id_pedido_escola);
    if ("error" in importado) throw new Error(importado.error);
    expect(importado.success).toBe(true);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: importado.id_nota_saida },
      include: { itens: true },
    });
    expect(nota.id_destinatario).toBe(destinatario.id_destinatario);
    expect(Number(nota.itens[0]!.qtd_esperada)).toBe(3);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: criado.id_pedido_escola },
    });
    expect(pedido.id_nota_saida).toBe(nota.id_nota_saida);
    expect(await listarPedidosParaImportacao()).toHaveLength(0);

    const segunda = await importarPedidoParaSaida(criado.id_pedido_escola);
    expect("error" in segunda).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(1);
  });

  it("sem nota_saida.criar a importação é recusada", async () => {
    const { destinatario, produto } = await preparar([
      "pedido.criar",
      "pedido.aprovar",
    ]);

    const criado = await criarPedido({
      id_destinatario: destinatario.id_destinatario,
      itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
    });
    if ("error" in criado) throw new Error(criado.error);
    await aprovarPedido(criado.id_pedido_escola);

    expect(await importarPedidoParaSaida(criado.id_pedido_escola)).toEqual({
      error: "Sem permissão.",
    });
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("perfil só com pedido.aprovar lista e aprova pela tela", async () => {
    const { usuario, destinatario, produto } = await preparar(["pedido.aprovar"]);
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    const lista = await listarPedidos({ page: 1 });
    expect(lista.total).toBe(1);
    expect(lista.data[0]!.id_pedido_escola).toBe(criado.pedido.id_pedido_escola);

    const aprovado = await aprovarPedido(criado.pedido.id_pedido_escola);
    expect(aprovado).toEqual({ success: true });

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: criado.pedido.id_pedido_escola },
    });
    expect(pedido.status).toBe("CONFIRMADO");
  });
});

describe("listarPedidos — sanitização dos filtros", () => {
  it("ignora datas inválidas e search não-string sem lançar", async () => {
    const { usuario, destinatario, produto } = await preparar(["pedido.listar"]);
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    // `2026-02-31` não existe e `x` não é data: nenhuma das duas filtra.
    const invalidas = await listarPedidos({ de: "2026-02-31", ate: "x" } as never);
    expect(invalidas.total).toBe(1);

    // `search` não-string não pode estourar `.trim()`.
    const buscaInvalida = await listarPedidos({ search: 42 } as never);
    expect(buscaInvalida.total).toBe(1);

    // O período válido continua inclusivo no dia civil de São Paulo.
    const foraDoPeriodo = await listarPedidos({
      de: "2020-01-01",
      ate: "2020-01-02",
    });
    expect(foraDoPeriodo.total).toBe(0);
  });
});
