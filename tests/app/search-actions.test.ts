import { describe, expect, it, vi } from "vitest";
import {
  criarDestinatario,
  criarExpedicao,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

/**
 * `search` chega cru no payload das Server Actions: número, objeto ou array não
 * podem lançar (`trim`/`contains`) nem recortar a lista — só `string` filtra.
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

import { listarDestinatarios } from "@/app/destinatarios/actions";
import { listarExpedicoes } from "@/app/expedicoes/actions";
import { listarProdutos } from "@/app/produtos/actions";

async function preparar(nomes: string[]) {
  // `senhaAlteradaEm` explícito: o default do factory não é aceito pelo MariaDB
  // local (`senha_alterada_em` mínimo 1000-01-01) — falha de ambiente
  // pré-existente, fora do escopo deste run.
  const { usuario } = await criarUsuario({
    senhaAlteradaEm: new Date("2026-01-01T00:00:00Z"),
  });
  sessao.id_usuario = usuario.id_usuario;
  permissoes.nomes = nomes;
}

describe("listarExpedicoes — search não-string", () => {
  it("não lança e ignora o termo inválido, mantendo a busca válida", async () => {
    await preparar(["expedicao.listar"]);
    const expedicao = await criarExpedicao();
    await prismaTeste.expedicao.update({
      where: { id_expedicao: expedicao.id_expedicao },
      data: { observacao: "Rota Norte" },
    });

    for (const invalido of [123, { termo: "Norte" }, ["Norte"], true]) {
      const resultado = await listarExpedicoes({
        search: invalido as unknown as string,
      });
      expect(resultado.data.map((linha) => linha.id_expedicao)).toContain(
        expedicao.id_expedicao,
      );
    }

    const comBusca = await listarExpedicoes({ search: "  Norte  " });
    expect(comBusca.data.map((linha) => linha.id_expedicao)).toEqual([
      expedicao.id_expedicao,
    ]);
  });
});

describe("listarDestinatarios — search não-string", () => {
  it("não lança e devolve a lista sem recorte", async () => {
    await preparar(["destinatario.listar"]);
    const alfa = await criarDestinatario({ razaoSocial: "Escola Alfa" });
    const beta = await criarDestinatario({ razaoSocial: "Creche Beta" });

    const comInvalido = await listarDestinatarios({
      search: { termo: "Alfa" } as unknown as string,
    });
    expect(
      comInvalido.data.map((linha) => linha.id_destinatario).sort((a, b) => a - b),
    ).toEqual(
      [alfa.destinatario.id_destinatario, beta.destinatario.id_destinatario].sort(
        (a, b) => a - b,
      ),
    );

    const comNumero = await listarDestinatarios({
      search: 42 as unknown as string,
    });
    expect(comNumero.total).toBe(2);

    const comBusca = await listarDestinatarios({ search: "Beta" });
    expect(comBusca.data.map((linha) => linha.id_destinatario)).toEqual([
      beta.destinatario.id_destinatario,
    ]);
  });
});

describe("listarProdutos — search não-string", () => {
  it("não lança e cai na listagem padrão", async () => {
    await preparar(["produto.listar"]);
    const produto = await criarProduto({ descricao: "Arroz Tipo 1" });

    const comNumero = await listarProdutos({ search: 99 as unknown as string });
    expect(comNumero.data.map((linha) => linha.id_produto)).toEqual([
      produto.id_produto,
    ]);

    const comArray = await listarProdutos({
      search: ["Arroz"] as unknown as string,
    });
    expect(comArray.data.map((linha) => linha.id_produto)).toEqual([
      produto.id_produto,
    ]);

    const comBusca = await listarProdutos({ search: "Arroz" });
    expect(comBusca.data.map((linha) => linha.id_produto)).toEqual([
      produto.id_produto,
    ]);
  });
});
