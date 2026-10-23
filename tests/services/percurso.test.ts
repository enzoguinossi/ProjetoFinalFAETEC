import { describe, expect, it, vi } from "vitest";
import { criarDestinatario, criarUsuario } from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";
import { percursoDAO } from "@/dao/percurso";
import { percursoService } from "@/services/percurso";

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
  desativarPercurso,
  salvarPercurso,
} from "@/app/expedicoes/percursos/actions";

async function criarDestinatarios(quantidade: number) {
  const lista = [];
  for (let i = 0; i < quantidade; i++) {
    const { destinatario } = await criarDestinatario();
    lista.push(destinatario);
  }
  return lista;
}

describe("percursoService", () => {
  it("cria um percurso com a ordem de visita contínua e registra auditoria", async () => {
    const { usuario } = await criarUsuario();
    const destinatarios = await criarDestinatarios(3);

    const resultado = await percursoService.criar(
      {
        nome: "Escolas da roça",
        descricao: "Percurso da zona rural",
        destinatarios: destinatarios.map((d, indice) => ({
          id_destinatario: d.id_destinatario,
          ordem_visita: indice + 1,
        })),
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) throw new Error(resultado.error);

    const percurso = await prismaTeste.percurso.findUniqueOrThrow({
      where: { id_percurso: resultado.percurso.id_percurso },
      include: { destinatarios: { orderBy: { ordem_visita: "asc" } } },
    });

    expect(percurso.ativo).toBe(true);
    expect(percurso.nome).toBe("Escolas da roça");
    expect(
      percurso.destinatarios.map((d) => ({
        id_destinatario: d.id_destinatario,
        ordem_visita: d.ordem_visita,
      })),
    ).toEqual(
      destinatarios.map((d, indice) => ({
        id_destinatario: d.id_destinatario,
        ordem_visita: indice + 1,
      })),
    );

    const auditorias = await auditoriasDe("Percurso", percurso.id_percurso);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("CRIAR");
    expect(auditorias[0]?.dados_novos).toMatchObject({
      nome: "Escolas da roça",
      destinatarios: destinatarios.map((d, indice) => ({
        id_destinatario: d.id_destinatario,
        ordem_visita: indice + 1,
      })),
    });
  });

  it("recusa nome já usado por outro percurso ativo", async () => {
    const { usuario } = await criarUsuario();
    const [destinatario] = await criarDestinatarios(1);
    if (!destinatario) throw new Error("destinatário não criado");

    const primeiro = await percursoService.criar(
      {
        nome: "Percurso único",
        destinatarios: [
          { id_destinatario: destinatario.id_destinatario, ordem_visita: 1 },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in primeiro).toBe(false);

    const segundo = await percursoService.criar(
      {
        nome: "Percurso único",
        destinatarios: [
          { id_destinatario: destinatario.id_destinatario, ordem_visita: 1 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in segundo).toBe(true);
    if ("error" in segundo) {
      expect(segundo.error).toContain("Já existe um percurso ativo");
    }
    expect(await prismaTeste.percurso.count()).toBe(1);
  });

  it("recusa percurso sem destinatário", async () => {
    const { usuario } = await criarUsuario();

    const resultado = await percursoService.criar(
      { nome: "Percurso vazio", destinatarios: [] },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    if ("error" in resultado) {
      expect(resultado.error).toContain("ao menos um destinatário");
    }
    expect(await prismaTeste.percurso.count()).toBe(0);
  });

  it("recusa o mesmo destinatário repetido", async () => {
    const { usuario } = await criarUsuario();
    const [destinatario] = await criarDestinatarios(1);
    if (!destinatario) throw new Error("destinatário não criado");

    const resultado = await percursoService.criar(
      {
        nome: "Percurso repetido",
        destinatarios: [
          { id_destinatario: destinatario.id_destinatario, ordem_visita: 1 },
          { id_destinatario: destinatario.id_destinatario, ordem_visita: 2 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    if ("error" in resultado) {
      expect(resultado.error).toContain("mesmo destinatário");
    }
    expect(await prismaTeste.percurso.count()).toBe(0);
  });

  it("recusa ordem de visita com buraco (não contínua)", async () => {
    const { usuario } = await criarUsuario();
    const destinatarios = await criarDestinatarios(2);
    const [primeiro, segundo] = destinatarios;
    if (!primeiro || !segundo) throw new Error("destinatários não criados");

    const resultado = await percursoService.criar(
      {
        nome: "Percurso com buraco",
        destinatarios: [
          { id_destinatario: primeiro.id_destinatario, ordem_visita: 1 },
          { id_destinatario: segundo.id_destinatario, ordem_visita: 3 },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    if ("error" in resultado) {
      expect(resultado.error).toContain("contínua");
    }
    expect(await prismaTeste.percurso.count()).toBe(0);
  });

  it("altera o percurso reordenando as visitas e registra auditoria", async () => {
    const { usuario } = await criarUsuario();
    const [primeiro, segundo, terceiro] = await criarDestinatarios(3);
    if (!primeiro || !segundo || !terceiro) throw new Error("destinatários não criados");

    const criado = await percursoService.criar(
      {
        nome: "Percurso original",
        destinatarios: [
          { id_destinatario: primeiro.id_destinatario, ordem_visita: 1 },
          { id_destinatario: segundo.id_destinatario, ordem_visita: 2 },
          { id_destinatario: terceiro.id_destinatario, ordem_visita: 3 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    const alterado = await percursoService.alterar(
      criado.percurso.id_percurso,
      {
        nome: "Percurso reordenado",
        destinatarios: [
          { id_destinatario: segundo.id_destinatario, ordem_visita: 1 },
          { id_destinatario: terceiro.id_destinatario, ordem_visita: 2 },
          { id_destinatario: primeiro.id_destinatario, ordem_visita: 3 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in alterado) throw new Error(alterado.error);

    const percurso = await prismaTeste.percurso.findUniqueOrThrow({
      where: { id_percurso: criado.percurso.id_percurso },
      include: { destinatarios: { orderBy: { ordem_visita: "asc" } } },
    });

    expect(percurso.nome).toBe("Percurso reordenado");
    expect(
      percurso.destinatarios.map((d) => ({
        id_destinatario: d.id_destinatario,
        ordem_visita: d.ordem_visita,
      })),
    ).toEqual([
      { id_destinatario: segundo.id_destinatario, ordem_visita: 1 },
      { id_destinatario: terceiro.id_destinatario, ordem_visita: 2 },
      { id_destinatario: primeiro.id_destinatario, ordem_visita: 3 },
    ]);

    const auditorias = await auditoriasDe("Percurso", percurso.id_percurso);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "ALTERAR"]);
    expect(auditorias[1]?.dados_anteriores).toMatchObject({
      nome: "Percurso original",
      destinatarios: [
        { id_destinatario: primeiro.id_destinatario, ordem_visita: 1 },
        { id_destinatario: segundo.id_destinatario, ordem_visita: 2 },
        { id_destinatario: terceiro.id_destinatario, ordem_visita: 3 },
      ],
    });
    expect(auditorias[1]?.dados_novos).toMatchObject({
      nome: "Percurso reordenado",
      destinatarios: [
        { id_destinatario: segundo.id_destinatario, ordem_visita: 1 },
        { id_destinatario: terceiro.id_destinatario, ordem_visita: 2 },
        { id_destinatario: primeiro.id_destinatario, ordem_visita: 3 },
      ],
    });
  });

  it("desativa sem apagar o registro nem as visitas e registra auditoria", async () => {
    const { usuario } = await criarUsuario();
    const destinatarios = await criarDestinatarios(2);

    const criado = await percursoService.criar(
      {
        nome: "Percurso a desativar",
        destinatarios: destinatarios.map((d, indice) => ({
          id_destinatario: d.id_destinatario,
          ordem_visita: indice + 1,
        })),
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    const desativado = await percursoService.desativar(
      criado.percurso.id_percurso,
      usuario.id_usuario,
    );
    expect("error" in desativado).toBe(false);

    const percurso = await prismaTeste.percurso.findUniqueOrThrow({
      where: { id_percurso: criado.percurso.id_percurso },
    });
    expect(percurso.ativo).toBe(false);
    expect(await prismaTeste.percurso.count()).toBe(1);
    expect(
      await prismaTeste.percursoDestinatario.count({
        where: { id_percurso: percurso.id_percurso },
      }),
    ).toBe(2);

    const auditorias = await auditoriasDe("Percurso", percurso.id_percurso);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "DESATIVAR"]);
    expect(auditorias[1]?.dados_anteriores).toMatchObject({ nome: "Percurso a desativar" });

    // Não aparece mais para novas rotas (listagem de ativos).
    const ativos = await percursoDAO.list({ ativo: true });
    expect(ativos.total).toBe(0);
  });
});

describe("actions de percurso", () => {
  it("recusa salvar no servidor sem permissão e salva com percurso.criar", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    const [destinatario] = await criarDestinatarios(1);
    if (!destinatario) throw new Error("destinatário não criado");

    const form = new FormData();
    form.set("nome", "Percurso da permissão");
    form.set(
      "destinatarios",
      JSON.stringify([
        { id_destinatario: destinatario.id_destinatario, ordem_visita: 1 },
      ]),
    );

    permissoes.nomes = ["percurso.listar"];
    const semPermissao = await salvarPercurso(form);
    expect(semPermissao).toEqual({ error: "Sem permissão." });
    expect(await prismaTeste.percurso.count()).toBe(0);

    permissoes.nomes = ["percurso.criar"];
    const comPermissao = await salvarPercurso(form);
    expect(comPermissao).toMatchObject({ success: true });
    expect(await prismaTeste.percurso.count()).toBe(1);
  });

  it("recusa desativar sem percurso.desativar", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["percurso.criar"];

    const [destinatario] = await criarDestinatarios(1);
    if (!destinatario) throw new Error("destinatário não criado");

    const criado = await percursoService.criar(
      {
        nome: "Percurso sem permissão de desativar",
        destinatarios: [
          { id_destinatario: destinatario.id_destinatario, ordem_visita: 1 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    permissoes.nomes = ["percurso.alterar"];
    const resultado = await desativarPercurso(criado.percurso.id_percurso);

    expect(resultado).toEqual({ error: "Sem permissão." });
    const percurso = await prismaTeste.percurso.findUniqueOrThrow({
      where: { id_percurso: criado.percurso.id_percurso },
    });
    expect(percurso.ativo).toBe(true);
  });
});
