import { describe, expect, it } from "vitest";
import { tipoDestinatarioDAO } from "@/dao/tipo-destinatario";
import {
  criarDestinatario,
  criarTipoDestinatario,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("tipoDestinatarioDAO", () => {
  describe("list", () => {
    it("ordena por nome e conta os destinatários vinculados", async () => {
      const creche = await criarTipoDestinatario("Creche");
      const escola = await criarTipoDestinatario("Escola");
      await criarDestinatario({ idTipoDestinatario: escola.id_tipo_destinatario });
      await criarDestinatario({ idTipoDestinatario: escola.id_tipo_destinatario });

      const lista = await tipoDestinatarioDAO.list();

      expect(lista.map((t) => t.nome)).toEqual(["Creche", "Escola"]);
      expect(lista[0]).toMatchObject({
        id_tipo_destinatario: creche.id_tipo_destinatario,
        total_destinatarios: 0,
      });
      expect(lista[1]?.total_destinatarios).toBe(2);
    });
  });

  describe("getPadrao", () => {
    it("devolve o tipo padrão ou null quando não há", async () => {
      expect(await tipoDestinatarioDAO.getPadrao()).toBeNull();
      const padrao = await criarTipoDestinatario("Escola", { padrao: true });

      expect((await tipoDestinatarioDAO.getPadrao())?.id_tipo_destinatario).toBe(
        padrao.id_tipo_destinatario,
      );
    });
  });

  describe("create", () => {
    it("gera o código a partir do nome e registra auditoria CRIAR", async () => {
      const { usuario } = await criarUsuario();

      const criado = await tipoDestinatarioDAO.create(
        { nome: "Creche Municipal", padrao: false },
        usuario.id_usuario,
      );

      expect(criado).toMatchObject({
        codigo: "CRECHE_MUNICIPAL",
        nome: "Creche Municipal",
        padrao: false,
      });

      const auditorias = await auditoriasDe(
        "TipoDestinatario",
        criado.id_tipo_destinatario,
      );
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
      expect(auditorias[0]?.dados_novos).toMatchObject({
        codigo: "CRECHE_MUNICIPAL",
        nome: "Creche Municipal",
        padrao: false,
      });
    });

    it("não repete o código quando o slug já existe", async () => {
      const { usuario } = await criarUsuario();
      await tipoDestinatarioDAO.create({ nome: "Escola", padrao: false }, usuario.id_usuario);
      const segundo = await tipoDestinatarioDAO.create(
        { nome: "Escola!", padrao: false },
        usuario.id_usuario,
      );

      expect(segundo.codigo).toBe("ESCOLA_2");
    });

    it("mantém um único padrão ao criar outro tipo padrão", async () => {
      const { usuario } = await criarUsuario();
      const primeiro = await tipoDestinatarioDAO.create(
        { nome: "Escola", padrao: true },
        usuario.id_usuario,
      );
      const segundo = await tipoDestinatarioDAO.create(
        { nome: "Creche", padrao: true },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.tipoDestinatario.findMany();
      expect(noBanco.filter((t) => t.padrao).map((t) => t.id_tipo_destinatario)).toEqual([
        segundo.id_tipo_destinatario,
      ]);
      expect(
        noBanco.find((t) => t.id_tipo_destinatario === primeiro.id_tipo_destinatario)?.padrao,
      ).toBe(false);
    });

    it("recusa nome vazio ou longo", async () => {
      const { usuario } = await criarUsuario();

      await expect(
        tipoDestinatarioDAO.create({ nome: "   ", padrao: false }, usuario.id_usuario),
      ).rejects.toThrowError("Nome é obrigatório.");
      await expect(
        tipoDestinatarioDAO.create(
          { nome: "x".repeat(192), padrao: false },
          usuario.id_usuario,
        ),
      ).rejects.toThrowError("Nome muito longo (máximo 191 caracteres).");
    });

    it("serializa duas criações concorrentes de padrão (no máximo um)", async () => {
      const { usuario } = await criarUsuario();

      const resultados = await Promise.allSettled([
        tipoDestinatarioDAO.create({ nome: "Escola", padrao: true }, usuario.id_usuario),
        tipoDestinatarioDAO.create({ nome: "Creche", padrao: true }, usuario.id_usuario),
      ]);

      expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(
        await prismaTeste.tipoDestinatario.count({ where: { padrao: true } }),
      ).toBe(1);
    });

    it("libera o lock quando a criação de padrão falha", async () => {
      const { usuario } = await criarUsuario();
      await criarTipoDestinatario("Escola");

      await expect(
        tipoDestinatarioDAO.create({ nome: "Escola", padrao: true }, usuario.id_usuario),
      ).rejects.toThrowError("Já existe um tipo de escola com este nome.");

      const criado = await tipoDestinatarioDAO.create(
        { nome: "Creche", padrao: true },
        usuario.id_usuario,
      );
      expect(criado.padrao).toBe(true);
    });

    it("recusa nome duplicado", async () => {
      const { usuario } = await criarUsuario();
      await tipoDestinatarioDAO.create({ nome: "Escola", padrao: false }, usuario.id_usuario);

      await expect(
        tipoDestinatarioDAO.create({ nome: "escola", padrao: false }, usuario.id_usuario),
      ).rejects.toThrowError("Já existe um tipo de escola com este nome.");
    });
  });

  describe("update", () => {
    it("edita o nome, preserva o código e move o padrão", async () => {
      const { usuario } = await criarUsuario();
      const escola = await tipoDestinatarioDAO.create(
        { nome: "Escola", padrao: true },
        usuario.id_usuario,
      );
      const creche = await tipoDestinatarioDAO.create(
        { nome: "Creche", padrao: false },
        usuario.id_usuario,
      );

      const depois = await tipoDestinatarioDAO.update(
        creche.id_tipo_destinatario,
        { nome: "Creche Municipal", padrao: true },
        usuario.id_usuario,
      );

      expect(depois).toMatchObject({
        codigo: creche.codigo,
        nome: "Creche Municipal",
        padrao: true,
      });
      expect(
        (
          await prismaTeste.tipoDestinatario.findUniqueOrThrow({
            where: { id_tipo_destinatario: escola.id_tipo_destinatario },
          })
        ).padrao,
      ).toBe(false);

      const alteracao = (
        await auditoriasDe("TipoDestinatario", creche.id_tipo_destinatario)
      ).find((a) => a.acao === "ALTERAR");
      expect(alteracao).toBeDefined();
      expect(alteracao?.dados_anteriores).toMatchObject({
        codigo: creche.codigo,
        nome: "Creche",
        padrao: false,
      });
      expect(alteracao?.dados_novos).toMatchObject({
        codigo: creche.codigo,
        nome: "Creche Municipal",
        padrao: true,
      });
    });

    it("recusa nome já usado por outro tipo", async () => {
      const { usuario } = await criarUsuario();
      await tipoDestinatarioDAO.create({ nome: "Escola", padrao: false }, usuario.id_usuario);
      const creche = await tipoDestinatarioDAO.create(
        { nome: "Creche", padrao: false },
        usuario.id_usuario,
      );

      await expect(
        tipoDestinatarioDAO.update(
          creche.id_tipo_destinatario,
          { nome: "Escola", padrao: false },
          usuario.id_usuario,
        ),
      ).rejects.toThrowError("Já existe um tipo de escola com este nome.");
    });

    it("recusa nome vazio ou longo no DAO", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoDestinatario("Escola");

      await expect(
        tipoDestinatarioDAO.update(
          tipo.id_tipo_destinatario,
          { nome: "  ", padrao: false },
          usuario.id_usuario,
        ),
      ).rejects.toThrowError("Nome é obrigatório.");
      await expect(
        tipoDestinatarioDAO.update(
          tipo.id_tipo_destinatario,
          { nome: "y".repeat(192), padrao: false },
          usuario.id_usuario,
        ),
      ).rejects.toThrowError("Nome muito longo (máximo 191 caracteres).");
    });
  });

  describe("hardDelete", () => {
    it("exclui fisicamente e deixa os destinatários sem tipo, com auditoria", async () => {
      const { usuario } = await criarUsuario();
      const escola = await criarTipoDestinatario("Escola");
      const a = await criarDestinatario({ idTipoDestinatario: escola.id_tipo_destinatario });
      const b = await criarDestinatario({ idTipoDestinatario: escola.id_tipo_destinatario });

      await tipoDestinatarioDAO.hardDelete(escola.id_tipo_destinatario, usuario.id_usuario);

      expect(
        await prismaTeste.tipoDestinatario.findUnique({
          where: { id_tipo_destinatario: escola.id_tipo_destinatario },
        }),
      ).toBeNull();
      for (const { destinatario } of [a, b]) {
        expect(
          (
            await prismaTeste.destinatario.findUniqueOrThrow({
              where: { id_destinatario: destinatario.id_destinatario },
            })
          ).id_tipo_destinatario,
        ).toBeNull();
      }

      const auditorias = await auditoriasDe(
        "TipoDestinatario",
        escola.id_tipo_destinatario,
      );
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("EXCLUIR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        codigo: escola.codigo,
        nome: "Escola",
        destinatarios_afetados: 2,
      });
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        ids_destinatarios: [
          a.destinatario.id_destinatario,
          b.destinatario.id_destinatario,
        ],
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({ destinatarios_sem_tipo: 2 });
    });
  });
});
