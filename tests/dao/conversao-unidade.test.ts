import { describe, expect, it } from "vitest";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { criarConversao, criarProduto, criarUsuario } from "../helpers/factories";
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

  describe("create", () => {
    it("persiste a unidade e registra auditoria CRIAR", async () => {
      const { usuario } = await criarUsuario();

      const criada = await conversaoUnidadeDAO.create(
        { nome: "CX20", fator: 20, descricao: "Caixa com 20" },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.conversaoUnidade.findUniqueOrThrow({
        where: { id_conversao: criada.id_conversao },
      });
      expect(noBanco).toMatchObject({ nome: "CX20", fator: 20, descricao: "Caixa com 20" });

      const auditorias = await auditoriasDe("ConversaoUnidade", criada.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
      expect(auditorias[0]?.dados_novos).toMatchObject({ nome: "CX20", fator: 20 });
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
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ nome: "CX20", fator: 20 });
      expect(auditorias[0]?.dados_novos).toMatchObject({ nome: "CX24", fator: 24 });
    });
  });

  describe("hardDelete", () => {
    it("desvincula produtos, exclui a unidade e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const unidade = await criarConversao("CX20", 20);
      const produto = await criarProduto({ idConversaoPadrao: unidade.id_conversao });

      await conversaoUnidadeDAO.hardDelete(unidade.id_conversao, usuario.id_usuario);

      expect(
        await prismaTeste.conversaoUnidade.findUnique({
          where: { id_conversao: unidade.id_conversao },
        }),
      ).toBeNull();
      const produtoApos = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: produto.id_produto },
      });
      expect(produtoApos.id_conversao_padrao).toBeNull();

      const auditorias = await auditoriasDe("ConversaoUnidade", unidade.id_conversao);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("EXCLUIR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ nome: "CX20" });
    });
  });
});
