import { describe, expect, it } from "vitest";
import {
  formatarQuantidadeCsv,
  gerarCsvProdutos,
  metadadosEmissao,
  normalizarFiltrosProdutos,
} from "@/services/relatorio";
import type { ProdutoRelatorioRow } from "@/dao/relatorio";

const linha: ProdutoRelatorioRow = {
  id_produto: 1,
  codigo: "000001",
  descricao: "Arroz",
  unidade: "CX",
  quantidade: 10,
  livre: 7.5,
  situacao: "Ativo",
};

describe("serviço de relatórios", () => {
  describe("normalizarFiltrosProdutos", () => {
    it("usa ativas como padrão", () => {
      expect(normalizarFiltrosProdutos()).toEqual({ situacao: "ativas" });
    });

    it("aceita situação válida, inclusive em array, e ignora valor inválido", () => {
      expect(normalizarFiltrosProdutos({ situacao: "todas" }).situacao).toBe("todas");
      expect(normalizarFiltrosProdutos({ situacao: ["inativas", "todas"] }).situacao).toBe(
        "inativas",
      );
      expect(normalizarFiltrosProdutos({ situacao: "qualquer" }).situacao).toBe("ativas");
    });
  });

  describe("metadadosEmissao", () => {
    it("formata data e hora no fuso de São Paulo", () => {
      const emissao = metadadosEmissao(new Date("2026-10-24T15:30:00Z"));
      expect(emissao).toEqual({ data: "24/10/2026", hora: "12:30" });
    });
  });

  describe("CSV", () => {
    it("formata quantidade com vírgula e sem separador de milhar", () => {
      expect(formatarQuantidadeCsv(10)).toBe("10");
      expect(formatarQuantidadeCsv(7.5)).toBe("7,5");
      expect(formatarQuantidadeCsv(1234.25)).toBe("1234,25");
    });

    it("gera CSV com BOM, cabeçalho e separador ponto e vírgula", () => {
      const csv = gerarCsvProdutos([linha]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Descrição;Unidade;Quantidade;Qtd. Livre;Situação\r\n" +
          "000001;Arroz;CX;10;7,5;Ativo\r\n",
      );
    });

    it("protege campos com ponto e vírgula, aspas e quebra de linha", () => {
      const csv = gerarCsvProdutos([
        { ...linha, descricao: 'Arroz "tipo 1"; integral\nrefinado' },
      ]);

      expect(csv).toContain('"Arroz ""tipo 1""; integral\nrefinado"');
    });
  });
});
