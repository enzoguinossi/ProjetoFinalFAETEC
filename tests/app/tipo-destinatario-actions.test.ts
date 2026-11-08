import { describe, expect, it, vi } from "vitest";
import {
  criarTipoDestinatario as criarTipoDestinatarioTeste,
  criarUsuario,
} from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

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
  listarTiposDestinatario,
  criarTipoDestinatario,
  atualizarTipoDestinatario,
  excluirTipoDestinatario,
} from "@/app/tipos-destinatario/actions";

async function preparar(nomes: string[]) {
  const { usuario } = await criarUsuario({
    senhaAlteradaEm: new Date("2026-01-01T00:00:00Z"),
  });
  sessao.id_usuario = usuario.id_usuario;
  permissoes.nomes = nomes;
  return usuario;
}

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

describe("actions de tipo de destinatário", () => {
  it("lista os tipos sem permissão de escrita do cadastro (vazio)", async () => {
    await preparar([]);
    await criarTipoDestinatarioTeste("Escola");

    expect(await listarTiposDestinatario()).toEqual([]);
  });

  it("lista os tipos para quem pode criar destinatário e cria com padrão", async () => {
    await preparar(["destinatario.criar"]);
    const outro = await criarTipoDestinatarioTeste("Creche", { padrao: true });

    const lista = await listarTiposDestinatario();
    expect(lista.map((t) => t.nome)).toEqual(["Creche"]);
    expect(lista[0]?.total_destinatarios).toBe(0);

    permissoes.nomes = ["tipo_destinatario.criar"];
    const resultado = await criarTipoDestinatario(
      formulario({ nome: "Escola", padrao: "on" }),
    );
    expect(resultado).toEqual({ success: true });

    const criado = await prismaTeste.tipoDestinatario.findUniqueOrThrow({
      where: { nome: "Escola" },
    });
    expect(criado.codigo).toBe("ESCOLA");
    expect(criado.padrao).toBe(true);
    expect(
      (
        await prismaTeste.tipoDestinatario.findUniqueOrThrow({
          where: { id_tipo_destinatario: outro.id_tipo_destinatario },
        })
      ).padrao,
    ).toBe(false);
  });

  it("exige permissão e exclui fisicamente", async () => {
    await preparar([]);
    const tipo = await criarTipoDestinatarioTeste("Escola", { padrao: false });

    expect(await excluirTipoDestinatario(tipo.id_tipo_destinatario)).toEqual({
      error: "Sem permissão.",
    });

    permissoes.nomes = ["tipo_destinatario.excluir"];
    expect(await excluirTipoDestinatario(tipo.id_tipo_destinatario)).toEqual({
      success: true,
    });
    expect(
      await prismaTeste.tipoDestinatario.findUnique({
        where: { id_tipo_destinatario: tipo.id_tipo_destinatario },
      }),
    ).toBeNull();
  });

  it("valida o nome ao alterar e preserva o código", async () => {
    await preparar(["tipo_destinatario.alterar"]);
    const tipo = await criarTipoDestinatarioTeste("Escola");

    expect(
      await atualizarTipoDestinatario(
        formulario({ id_tipo_destinatario: String(tipo.id_tipo_destinatario), nome: "  " }),
      ),
    ).toEqual({ error: "Nome é obrigatório." });

    expect(
      await atualizarTipoDestinatario(
        formulario({
          id_tipo_destinatario: String(tipo.id_tipo_destinatario),
          nome: "Escola Municipal",
          padrao: "on",
        }),
      ),
    ).toEqual({ success: true });

    const depois = await prismaTeste.tipoDestinatario.findUniqueOrThrow({
      where: { id_tipo_destinatario: tipo.id_tipo_destinatario },
    });
    expect(depois).toMatchObject({
      codigo: tipo.codigo,
      nome: "Escola Municipal",
      padrao: true,
    });
  });
});
