import { describe, expect, it } from "vitest";
import { muralDAO } from "@/dao/mural";
import { prismaTeste } from "../helpers/prisma";
import { criarUsuario } from "../helpers/factories";

const BASE = new Date("2026-10-25T12:00:00.000Z");

function emHora(horas: number) {
  return new Date(BASE.getTime() + horas * 60 * 60 * 1000);
}

async function criarMensagem(
  dados: {
    conteudo?: string;
    id_usuario?: number | null;
    data_publicacao?: Date;
    data_expiracao?: Date | null;
    automatica?: boolean;
    ativo?: boolean;
    chave?: string | null;
  } = {},
) {
  return prismaTeste.mensagemMural.create({
    data: {
      conteudo: dados.conteudo ?? "mensagem de teste",
      id_usuario: dados.id_usuario ?? null,
      data_publicacao: dados.data_publicacao ?? BASE,
      data_expiracao: dados.data_expiracao ?? null,
      automatica: dados.automatica ?? false,
      ativo: dados.ativo ?? true,
      chave: dados.chave ?? null,
    },
  });
}

describe("muralDAO", () => {
  describe("listarAtivas", () => {
    it("traz só ativas não expiradas, mais recentes primeiro", async () => {
      const { usuario } = await criarUsuario({ nome: "Maria Operadora" });
      const manual = await criarMensagem({
        id_usuario: usuario.id_usuario,
        conteudo: "manual ativa",
        data_publicacao: emHora(-2),
      });
      const automatica = await criarMensagem({
        conteudo: "automática ativa",
        automatica: true,
        chave: "validade:1:30",
        data_publicacao: emHora(-1),
      });
      await criarMensagem({ conteudo: "desativada", ativo: false });
      await criarMensagem({
        conteudo: "expirada",
        data_expiracao: emHora(-1),
      });

      const ativas = await muralDAO.listarAtivas(BASE);

      expect(ativas.map((m) => m.id_mensagem_mural)).toEqual([
        automatica.id_mensagem_mural,
        manual.id_mensagem_mural,
      ]);
      expect(ativas[0]?.autor).toBe("Sistema");
      expect(ativas[1]?.autor).toBe("Maria Operadora");
    });

    it("mantém mensagem ativa sem expiração e exclui a que expira agora", async () => {
      const semExpiracao = await criarMensagem({ data_publicacao: emHora(-1) });
      await criarMensagem({ data_expiracao: BASE });

      const ativas = await muralDAO.listarAtivas(BASE);

      expect(ativas).toHaveLength(1);
      expect(ativas[0]?.id_mensagem_mural).toBe(semExpiracao.id_mensagem_mural);
    });
  });

  describe("listarAnteriores", () => {
    it("inclui manuais e automáticas desativadas ou expiradas", async () => {
      const manualDesativada = await criarMensagem({
        ativo: false,
        data_publicacao: emHora(-1),
      });
      const manualExpirada = await criarMensagem({
        data_expiracao: emHora(-2),
        data_publicacao: emHora(-2),
      });
      const automaticaDesativada = await criarMensagem({
        automatica: true,
        ativo: false,
        data_publicacao: emHora(-3),
      });
      await criarMensagem({ data_publicacao: emHora(-4) });

      const anteriores = await muralDAO.listarAnteriores(BASE);

      expect(anteriores.map((m) => m.id_mensagem_mural)).toEqual([
        manualDesativada.id_mensagem_mural,
        manualExpirada.id_mensagem_mural,
        automaticaDesativada.id_mensagem_mural,
      ]);
    });
  });

  describe("criar, atualizar e desativar", () => {
    it("desativa sem apagar o registro (histórico preservado)", async () => {
      const criada = await criarMensagem({ conteudo: "original" });

      await muralDAO.atualizar(criada.id_mensagem_mural, {
        titulo: "Aviso",
        conteudo: "editada",
        data_expiracao: null,
      });
      await muralDAO.desativar(criada.id_mensagem_mural);

      const noBanco = await prismaTeste.mensagemMural.findUniqueOrThrow({
        where: { id_mensagem_mural: criada.id_mensagem_mural },
      });
      expect(noBanco).toMatchObject({
        titulo: "Aviso",
        conteudo: "editada",
        ativo: false,
      });
    });

    it("desativar automática libera a chave", async () => {
      const automatica = await criarMensagem({
        automatica: true,
        chave: "validade:7:30",
      });

      await muralDAO.desativarAutomatica(automatica.id_mensagem_mural);

      const noBanco = await prismaTeste.mensagemMural.findUniqueOrThrow({
        where: { id_mensagem_mural: automatica.id_mensagem_mural },
      });
      expect(noBanco.ativo).toBe(false);
      expect(noBanco.chave).toBeNull();
    });
  });

  describe("sino", () => {
    it("conta novas pelo marcador do usuário e ignora expiradas", async () => {
      const { usuario } = await criarUsuario();
      const antiga = await criarMensagem({ data_publicacao: emHora(-3) });
      await criarMensagem({ data_publicacao: emHora(-2) });
      await criarMensagem({
        data_publicacao: emHora(-1),
        data_expiracao: BASE,
      });

      expect(await muralDAO.contarNovas(usuario.id_usuario, BASE)).toBe(2);

      await prismaTeste.mensagemMural.update({
        where: { id_mensagem_mural: antiga.id_mensagem_mural },
        data: { ativo: false },
      });
      expect(await muralDAO.contarNovas(usuario.id_usuario, BASE)).toBe(1);
    });

    it("marcar visto zera a contagem e passa a contar só o que vier depois", async () => {
      const { usuario } = await criarUsuario();
      await criarMensagem({ data_publicacao: emHora(-1) });

      await muralDAO.marcarVisto(usuario.id_usuario, BASE);

      expect(await muralDAO.contarNovas(usuario.id_usuario, BASE)).toBe(0);
      expect(await muralDAO.obterVistoEm(usuario.id_usuario)).toEqual(BASE);

      await criarMensagem({ data_publicacao: emHora(1) });
      expect(await muralDAO.contarNovas(usuario.id_usuario, BASE)).toBe(1);
    });

    it("usuário inexistente não quebra a contagem", async () => {
      await expect(muralDAO.contarNovas(999999)).resolves.toBe(0);
    });
  });
});
