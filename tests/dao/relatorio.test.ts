import { describe, expect, it } from "vitest";
import { relatorioDAO } from "@/dao/relatorio";
import { criarConversao, criarEstoque, criarProduto } from "../helpers/factories";

describe("relatorioDAO", () => {
  describe("listarProdutosRelatorio", () => {
    it("lista ativas por padrão, ordena por descrição e soma os estoques ativos", async () => {
      const caixa = await criarConversao("CX");
      const arroz = await criarProduto({
        descricao: "Arroz",
        idConversaoPadrao: caixa.id_conversao,
      });
      const feijao = await criarProduto({ descricao: "Feijão" });
      await criarProduto({ descricao: "Açúcar", ativo: false });

      await criarEstoque(arroz.id_produto, { quantidadeAtual: 10, saldoReservado: 3 });
      await criarEstoque(arroz.id_produto, { quantidadeAtual: 5, saldoReservado: 2 });
      await criarEstoque(arroz.id_produto, { quantidadeAtual: 99, ativo: false });
      await criarEstoque(feijao.id_produto, { quantidadeAtual: 2.5 });

      const { data, totais } = await relatorioDAO.listarProdutosRelatorio();

      expect(data.map((p) => p.descricao)).toEqual(["Arroz", "Feijão"]);
      expect(data[0]).toMatchObject({
        id_produto: arroz.id_produto,
        codigo: String(arroz.id_produto).padStart(6, "0"),
        unidade: "CX",
        quantidade: 15,
        livre: 10,
        situacao: "Ativo",
      });
      expect(data[1]).toMatchObject({
        unidade: "UNIDADE",
        quantidade: 2.5,
        livre: 2.5,
      });
      expect(totais).toEqual({ quantidade: 17.5, livre: 12.5 });
    });

    it("filtra por situação inativas e todas", async () => {
      await criarProduto({ descricao: "Ativo" });
      await criarProduto({ descricao: "Inativo", ativo: false });

      const inativas = await relatorioDAO.listarProdutosRelatorio({ situacao: "inativas" });
      expect(inativas.data.map((p) => p.descricao)).toEqual(["Inativo"]);
      expect(inativas.data[0]?.situacao).toBe("Inativo");

      const todas = await relatorioDAO.listarProdutosRelatorio({ situacao: "todas" });
      expect(todas.data.map((p) => p.descricao)).toEqual(["Ativo", "Inativo"]);
    });

    it("busca por descrição e por código numérico do produto", async () => {
      const alvo = await criarProduto({ descricao: "Leite integral" });
      await criarProduto({ descricao: "Café" });

      const porDescricao = await relatorioDAO.listarProdutosRelatorio({ busca: "leit" });
      expect(porDescricao.data.map((p) => p.descricao)).toEqual(["Leite integral"]);

      const codigo = String(alvo.id_produto).padStart(6, "0");
      const porCodigo = await relatorioDAO.listarProdutosRelatorio({ busca: codigo });
      expect(porCodigo.data.map((p) => p.id_produto)).toContain(alvo.id_produto);
    });

    it("devolve listas vazias e totais zerados sem produtos", async () => {
      const resultado = await relatorioDAO.listarProdutosRelatorio({ busca: "inexistente" });
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ quantidade: 0, livre: 0 });
    });
  });
});
