import { describe, expect, it, vi } from "vitest";
import { criarFuncionario, criarUsuario, criarVeiculo } from "../helpers/factories";

/**
 * As opções dos filtros de Expedições (veículo/condutor) são consultas de
 * leitura: quem tem `expedicao.listar`/`expedicao.consultar` precisa vê-las,
 * sem ganhar nenhuma permissão de mutação.
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
  listarCondutoresParaExpedicao,
  listarVeiculosParaExpedicao,
} from "@/app/expedicoes/actions";

describe("opções dos filtros de expedições", () => {
  async function preparar(nomes: string[]) {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = nomes;
  }

  it("lista veículos e condutores com expedicao.listar", async () => {
    await preparar(["expedicao.listar"]);
    const veiculo = await criarVeiculo({ placa: "CHP1234" });
    const { funcionario } = await criarFuncionario({
      nome: "Condutor Chip",
      condutor: true,
    });

    const veiculos = await listarVeiculosParaExpedicao({ search: "CHP" });
    expect(veiculos.data.map((linha) => linha.id_veiculo)).toEqual([
      veiculo.id_veiculo,
    ]);

    const condutores = await listarCondutoresParaExpedicao({ search: "Chip" });
    expect(condutores.data.map((linha) => linha.id_funcionario)).toEqual([
      funcionario.id_funcionario,
    ]);
  });

  it("sem permissão de expedição não lista as opções", async () => {
    await preparar([]);

    expect((await listarVeiculosParaExpedicao()).total).toBe(0);
    expect((await listarCondutoresParaExpedicao()).total).toBe(0);
  });
});
