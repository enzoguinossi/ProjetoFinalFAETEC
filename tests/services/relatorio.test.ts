import { describe, expect, it } from "vitest";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  formatarQuantidadeCsv,
  gerarCsvMovimentacoes,
  gerarCsvProdutos,
  limitesDoPeriodo,
  metadadosEmissao,
  normalizarFiltrosMovimentacao,
  normalizarFiltrosProdutos,
  periodoSemestreAtual,
} from "@/services/relatorio";
import type { MovimentacaoRelatorioRow, ProdutoRelatorioRow } from "@/dao/relatorio";

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

  describe("normalizarFiltrosMovimentacao", () => {
    it("usa o mês corrente no fuso de São Paulo como período padrão", () => {
      expect(
        normalizarFiltrosMovimentacao({}, new Date("2026-10-24T15:30:00.000Z")),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_produto: null,
        id_destinatario: null,
        id_fornecedor: null,
        tipo: "todos",
      });
    });

    it("considera o dia local de São Paulo na virada do mês", () => {
      // 2026-11-01T02:30Z ainda é 31/10 às 23:30 em São Paulo.
      expect(
        normalizarFiltrosMovimentacao({}, new Date("2026-11-01T02:30:00.000Z")),
      ).toMatchObject({ de: "2026-10-01", ate: "2026-10-31" });
    });

    it("aceita período, produto, destinatário, fornecedor e tipo, inclusive em array", () => {
      expect(
        normalizarFiltrosMovimentacao({
          de: "2026-09-01",
          ate: "2026-09-30",
          produto: "7",
          destinatario: "3",
          fornecedor: ["5", "6"],
          tipo: ["saida", "entrada"],
        }),
      ).toEqual({
        de: "2026-09-01",
        ate: "2026-09-30",
        id_produto: 7,
        id_destinatario: 3,
        id_fornecedor: 5,
        tipo: "saida",
      });
    });

    it("ignora data, produto, destinatário, fornecedor e tipo inválidos", () => {
      expect(
        normalizarFiltrosMovimentacao(
          {
            de: "2026-02-30",
            ate: "ontem",
            produto: "abc",
            destinatario: "0",
            fornecedor: "-2",
            tipo: "qualquer",
          },
          new Date("2026-10-24T15:30:00.000Z"),
        ),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_produto: null,
        id_destinatario: null,
        id_fornecedor: null,
        tipo: "todos",
      });
    });

    it("calcula o semestre corrente (jan–jun ou jul–dez) no fuso de São Paulo", () => {
      expect(periodoSemestreAtual(new Date("2026-03-10T15:00:00.000Z"))).toEqual({
        de: "2026-01-01",
        ate: "2026-06-30",
      });
      expect(periodoSemestreAtual(new Date("2026-10-24T15:30:00.000Z"))).toEqual({
        de: "2026-07-01",
        ate: "2026-12-31",
      });
      // 2027-01-01T02:30Z ainda é 31/12/2026 em São Paulo: segundo semestre.
      expect(periodoSemestreAtual(new Date("2027-01-01T02:30:00.000Z"))).toEqual({
        de: "2026-07-01",
        ate: "2026-12-31",
      });
    });

    it("converte o período para os instantes UTC do dia em São Paulo", () => {
      const limites = limitesDoPeriodo({ de: "2026-10-01", ate: "2026-10-31" });

      expect(limites.de.toISOString()).toBe("2026-10-01T03:00:00.000Z");
      expect(limites.ate.toISOString()).toBe("2026-11-01T02:59:59.999Z");
    });
  });

  describe("Movimentação — formatação", () => {
    it("formata data/hora de São Paulo e data ISO", () => {
      expect(formatarDataHoraRelatorio(new Date("2026-10-24T15:30:00.000Z"))).toBe(
        "24/10/2026 12:30",
      );
      expect(formatarDataISO("2026-10-01")).toBe("01/10/2026");
    });

    it("gera CSV com BOM, cabeçalho, ponto e vírgula e decimal com vírgula", () => {
      const movimentacao: MovimentacaoRelatorioRow = {
        id_movimentacao: 1,
        data_hora: new Date("2026-10-01T12:00:00.000Z"),
        id_produto: 1,
        codigo: "000001",
        produto: "Arroz",
        tipo: "Entrada",
        documento: "NE #3",
        destinatario_fornecedor: "Escola Municipal",
        quantidade: 10.5,
        saldo_anterior: 0,
        saldo_posterior: 10.5,
        usuario: "Maria Operadora",
        observacao: null,
      };

      const csv = gerarCsvMovimentacoes([movimentacao]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFData;Produto;Tipo;Documento;Destinatário / Fornecedor;Quantidade;Saldo anterior;Saldo posterior;Usuário;Observação\r\n" +
          "01/10/2026 09:00;000001 - Arroz;Entrada;NE #3;Escola Municipal;10,5;0;10,5;Maria Operadora;\r\n",
      );
    });

    it("usa travessão para saldos nulos e protege campos especiais", () => {
      const csv = gerarCsvMovimentacoes([
        {
          id_movimentacao: 2,
          data_hora: new Date("2026-10-02T12:00:00.000Z"),
          id_produto: 2,
          codigo: "000002",
          produto: "Feijão",
          tipo: "Ajuste",
          documento: "—",
          destinatario_fornecedor: "—",
          quantidade: -1,
          saldo_anterior: null,
          saldo_posterior: null,
          usuario: "João",
          observacao: 'Ajuste "manual"; conferido',
        },
      ]);

      expect(csv).toContain("000002 - Feijão;Ajuste;—;—;-1;—;—;João;");
      expect(csv).toContain('"Ajuste ""manual""; conferido"');
    });
  });
});
