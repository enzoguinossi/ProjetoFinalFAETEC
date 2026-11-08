import { describe, expect, it, vi } from "vitest";
import { criarProduto, criarUsuario } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

/**
 * O servidor é a barreira da permissão: sem `produto.ver_inativos`, o payload
 * (`incluirInativos`/`ativo`) não pode expor produtos inativos na listagem.
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

import { getProduto, listarProdutos, updateProduto } from "@/app/produtos/actions";

describe("listarProdutos — produto.ver_inativos", () => {
  async function preparar(nomes: string[]) {
    // `senhaAlteradaEm` explícito: o default `new Date(0)` do factory não é aceito
    // pelo MariaDB local (`senha_alterada_em` mínimo 1000-01-01) — falha de
    // ambiente pré-existente, fora do escopo deste run.
    const { usuario } = await criarUsuario({
      senhaAlteradaEm: new Date("2026-01-01T00:00:00Z"),
    });
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = nomes;

    const ativo = await criarProduto({ descricao: "Ativo lista" });
    const inativo = await criarProduto({ descricao: "Inativo lista", ativo: false });
    return { ativo, inativo };
  }

  it("sem a permissão não vê inativos, mesmo forçando incluirInativos/ativo", async () => {
    const { ativo } = await preparar(["produto.listar"]);

    const forcandoTodos = await listarProdutos({ incluirInativos: true, ativo: null });
    expect(forcandoTodos.data.map((linha) => linha.id_produto)).toEqual([ativo.id_produto]);

    const forcandoInativos = await listarProdutos({ incluirInativos: true, ativo: false });
    expect(forcandoInativos.data.map((linha) => linha.id_produto)).toEqual([ativo.id_produto]);
  });

  it("com a permissão vê ativos, inativos e ambos", async () => {
    const { ativo, inativo } = await preparar([
      "produto.listar",
      "produto.ver_inativos",
    ]);

    const semFiltro = await listarProdutos({});
    expect(semFiltro.data.map((linha) => linha.id_produto)).toEqual([ativo.id_produto]);

    const soInativos = await listarProdutos({ incluirInativos: true, ativo: false });
    expect(soInativos.data.map((linha) => linha.id_produto)).toEqual([inativo.id_produto]);

    const todos = await listarProdutos({ incluirInativos: true, ativo: null });
    expect(todos.data.map((linha) => linha.id_produto)).toEqual([
      ativo.id_produto,
      inativo.id_produto,
    ]);
  });
});

describe("getProduto/updateProduto — produto.ver_inativos", () => {
  async function preparar(nomes: string[]) {
    const { usuario } = await criarUsuario({
      senhaAlteradaEm: new Date("2026-01-01T00:00:00Z"),
    });
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = nomes;

    const inativo = await criarProduto({ descricao: "Inativo detalhe", ativo: false });
    const ativo = await criarProduto({ descricao: "Ativo detalhe" });
    return { ativo, inativo };
  }

  it("sem a permissão não obtém nem edita produto inativo por id", async () => {
    const { inativo } = await preparar(["produto.consultar", "produto.alterar"]);

    expect(await getProduto(inativo.id_produto)).toBeNull();

    const form = new FormData();
    form.set("id_produto", String(inativo.id_produto));
    form.set("descricao", "Tentativa de edição");
    expect(await updateProduto(form)).toEqual({ error: "Sem permissão." });

    // O registro não foi alterado pela tentativa recusada.
    expect(
      await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: inativo.id_produto },
      }),
    ).toMatchObject({ descricao: "Inativo detalhe", ativo: false });
  });

  it("com a permissão obtém o inativo", async () => {
    const { inativo } = await preparar(["produto.consultar", "produto.ver_inativos"]);

    const dados = await getProduto(inativo.id_produto);
    expect(dados?.id_produto).toBe(inativo.id_produto);
    expect(dados?.ativo).toBe(false);
  });
});
