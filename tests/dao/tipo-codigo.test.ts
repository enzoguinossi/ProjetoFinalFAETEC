import { describe, expect, it } from "vitest";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { criarTipoCodigo } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";

describe("tipoCodigoDAO", () => {
  describe("list", () => {
    it("retorna apenas tipos ativos, ordenados por nome", async () => {
      await criarTipoCodigo("DIGITACAO");
      await criarTipoCodigo("EAN13");
      await prismaTeste.tipoCodigo.create({ data: { nome: "INATIVO", ativo: false } });

      const lista = await tipoCodigoDAO.list();

      expect(lista.map((t) => t.nome)).toEqual(["DIGITACAO", "EAN13"]);
    });
  });

  describe("listParaEntidade", () => {
    it("retorna somente os tipos permitidos e ativos da entidade", async () => {
      await criarTipoCodigo("DIGITACAO");
      await criarTipoCodigo("EAN12");
      await criarTipoCodigo("EAN13");
      await criarTipoCodigo("COD_FORNECEDOR");
      await criarTipoCodigo("COD_ESCOLA");
      await prismaTeste.tipoCodigo.create({ data: { nome: "MATRICULA", ativo: false } });

      const lista = await tipoCodigoDAO.listParaEntidade("PRODUTO");

      expect(lista.map((t) => t.nome)).toEqual([
        "COD_FORNECEDOR",
        "DIGITACAO",
        "EAN12",
        "EAN13",
      ]);
    });
  });

  describe("getByNomes", () => {
    it("retorna os tipos pelos nomes informados", async () => {
      await criarTipoCodigo("DIGITACAO");
      await criarTipoCodigo("EAN13");

      const lista = await tipoCodigoDAO.getByNomes(["EAN13", "INEXISTENTE"]);

      expect(lista).toHaveLength(1);
      expect(lista[0]?.nome).toBe("EAN13");
    });

    it("retorna lista vazia sem consultar quando não há nomes", async () => {
      await criarTipoCodigo("DIGITACAO");

      expect(await tipoCodigoDAO.getByNomes([])).toEqual([]);
    });

    it("inclui tipos inativos (comportamento atual)", async () => {
      await prismaTeste.tipoCodigo.create({ data: { nome: "DIGITACAO", ativo: false } });

      const lista = await tipoCodigoDAO.getByNomes(["DIGITACAO"]);

      expect(lista).toHaveLength(1);
    });
  });
});
