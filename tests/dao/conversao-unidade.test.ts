import { describe, expect, it } from "vitest";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import {
  criarConversao,
  criarProduto,
  criarUsuario,
  garantirUnidadePadrao,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("conversaoUnidadeDAO", () => {
  describe("list", () => {
    it("retorna as unidades ordenadas por nome", async () => {
      await criarConversao("PCT10", 10);
      await criarConversao("CX20", 20);

      const lista = await conversaoUnidadeDAO.list();

      expect(lista.map((u) => u.nome)).toEqual(["CX20", "PCT10"]);
    });
  });

  describe("getById", () => {
    it("retorna a unidade existente", async () => {
      const criada = await criarConversao("UN", 1);

      const encontrada = await conversaoUnidadeDAO.getById(criada.id_conversao);

      expect(encontrada?.nome).toBe("UN");
    });

    it("retorna null quando não existe", async () => {
      expect(await conversaoUnidadeDAO.getById(999999)).toBeNull();
    });
  });

  describe("getPadrao", () => {
    it("devolve a unidade marcada como padrão", async () => {
      const padrao = await garantirUnidadePadrao();

      const encontrada = await conversaoUnidadeDAO.getPadrao();

      expect(encontrada?.id_conversao).toBe(padrao.id_conversao);
      expect(encontrada?.nome).toBe("UNIDADE");
      expect(encontrada?.fator).toBe(1);
    });

    it("devolve null quando não há unidade padrão", async () => {
      await criarConversao("CX20", 20);

      expect(await conversaoUnidadeDAO.getPadrao()).toBeNull();
    });
  });

  describe("create", () => {
    it("persiste a unidade não padrão e registra auditoria CRIAR", async () => {
      const { usuario } = await criarUsuario();

      const criada = await conversaoUnidadeDAO.create(
        { nome: "CX20", fator: 20, descricao: "Caixa com 20" },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.conversaoUnidade.findUniqueOrThrow({
        where: { id_conversao: criada.id_conversao },
      });
      expect(noBanco).toMatchObject({
        nome: "CX20",
        fator: 20,
        descricao: "Caixa com 20",
        padrao: false,
      });

      const auditorias = await auditoriasDe("ConversaoUnidade", criada.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
      expect(auditorias[0]?.dados_novos).toMatchObject({
        nome: "CX20",
        fator: 20,
      });
    });
  });

  describe("update", () => {
    it("altera a unidade e registra auditoria ALTERAR com antes/depois", async () => {
      const { usuario } = await criarUsuario();
      const criada = await criarConversao("CX20", 20);

      await conversaoUnidadeDAO.update(
        criada.id_conversao,
        { nome: "CX24", fator: 24, descricao: "Caixa com 24" },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.conversaoUnidade.findUniqueOrThrow({
        where: { id_conversao: criada.id_conversao },
      });
      expect(noBanco).toMatchObject({ nome: "CX24", fator: 24 });

      const auditorias = await auditoriasDe("ConversaoUnidade", criada.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        nome: "CX20",
        fator: 20,
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({
        nome: "CX24",
        fator: 24,
      });
    });

    it("recusa alterar nome ou fator da unidade padrão", async () => {
      const { usuario } = await criarUsuario();
      const padrao = await garantirUnidadePadrao();

      for (const dados of [
        { nome: "UNIDADE2" },
        { fator: 2 },
      ]) {
        await expect(
          conversaoUnidadeDAO.update(padrao.id_conversao, dados, usuario.id_usuario),
        ).rejects.toThrowError("A unidade padrão não pode ser alterada.");
      }

      const noBanco = await prismaTeste.conversaoUnidade.findUniqueOrThrow({
        where: { id_conversao: padrao.id_conversao },
      });
      expect(noBanco).toMatchObject({ nome: "UNIDADE", fator: 1 });
      expect(await auditoriasDe("ConversaoUnidade", padrao.id_conversao)).toHaveLength(0);
    });

    it("permite alterar a descrição da unidade padrão", async () => {
      const { usuario } = await criarUsuario();
      const padrao = await garantirUnidadePadrao();

      await conversaoUnidadeDAO.update(
        padrao.id_conversao,
        {
          nome: padrao.nome,
          fator: padrao.fator,
          descricao: "Unidade padrão do sistema",
        },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.conversaoUnidade.findUniqueOrThrow({
        where: { id_conversao: padrao.id_conversao },
      });
      expect(noBanco.descricao).toBe("Unidade padrão do sistema");
      expect(noBanco).toMatchObject({ nome: "UNIDADE", fator: 1 });
    });
  });

  describe("hardDelete", () => {
    it("recusa excluir a unidade padrão", async () => {
      const { usuario } = await criarUsuario();
      const padrao = await garantirUnidadePadrao();

      await expect(
        conversaoUnidadeDAO.hardDelete(padrao.id_conversao, usuario.id_usuario),
      ).rejects.toThrowError("A unidade padrão não pode ser excluída.");
      expect(
        await prismaTeste.conversaoUnidade.findUnique({
          where: { id_conversao: padrao.id_conversao },
        }),
      ).not.toBeNull();
      expect(await auditoriasDe("ConversaoUnidade", padrao.id_conversao)).toHaveLength(0);
    });

    it("exclui unidade em uso e revincula os produtos à unidade padrão", async () => {
      const { usuario } = await criarUsuario();
      const padrao = await garantirUnidadePadrao();
      const unidade = await criarConversao("CX20", 20);
      const produto = await criarProduto({ idConversaoPadrao: unidade.id_conversao });

      await conversaoUnidadeDAO.hardDelete(unidade.id_conversao, usuario.id_usuario);

      expect(
        await prismaTeste.conversaoUnidade.findUnique({
          where: { id_conversao: unidade.id_conversao },
        }),
      ).toBeNull();

      const produtoDepois = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: produto.id_produto },
      });
      expect(produtoDepois.id_conversao_padrao).toBe(padrao.id_conversao);

      const auditorias = await auditoriasDe("ConversaoUnidade", unidade.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("EXCLUIR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        nome: "CX20",
        fator: 20,
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({ produtos_revinculados: 1 });
    });

    it("exclui a unidade sem uso e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      await garantirUnidadePadrao();
      const unidade = await criarConversao("CX20", 20);

      await conversaoUnidadeDAO.hardDelete(unidade.id_conversao, usuario.id_usuario);

      expect(
        await prismaTeste.conversaoUnidade.findUnique({
          where: { id_conversao: unidade.id_conversao },
        }),
      ).toBeNull();

      const auditorias = await auditoriasDe("ConversaoUnidade", unidade.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("EXCLUIR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        nome: "CX20",
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({ produtos_revinculados: 0 });
    });
  });
});
