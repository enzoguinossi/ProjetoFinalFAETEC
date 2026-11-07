import { describe, expect, it, vi } from "vitest";
import { criarUsuario, criarVeiculo } from "../helpers/factories";

/**
 * O filtro de status chega pela UI como `string[]`; a action precisa repassar
 * ao DAO e descartar valores fora do domínio (`STATUS_VEICULO`).
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

import { listarVeiculos } from "@/app/veiculos/actions";

describe("listarVeiculos — filtro de status", () => {
  async function preparar() {
    // `senhaAlteradaEm` explícito pela falha de ambiente pré-existente
    // (`senha_alterada_em`/1970) documentada no run.
    const { usuario } = await criarUsuario({
      senhaAlteradaEm: new Date("2026-01-01T00:00:00Z"),
    });
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["veiculo.listar"];

    const disponivel = await criarVeiculo({ status: "DISPONIVEL" });
    const emExpedicao = await criarVeiculo({ status: "EM_EXPEDICAO" });
    await criarVeiculo({ status: "INDISPONIVEL" });
    return { disponivel, emExpedicao };
  }

  it("repassa status múltiplos e ignora valores inválidos", async () => {
    const { disponivel, emExpedicao } = await preparar();

    const varios = await listarVeiculos({
      status: ["DISPONIVEL", "EM_EXPEDICAO", "INVALIDO"],
    });
    expect(varios.total).toBe(2);
    expect(varios.data.map((v) => v.id_veiculo).sort((a, b) => a - b)).toEqual(
      [disponivel.id_veiculo, emExpedicao.id_veiculo].sort((a, b) => a - b),
    );
  });

  it("sem status — ou só com valores inválidos — não filtra", async () => {
    await preparar();

    expect((await listarVeiculos({})).total).toBe(3);
    expect((await listarVeiculos({ status: ["INVALIDO"] })).total).toBe(3);
  });
});
