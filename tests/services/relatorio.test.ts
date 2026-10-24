import { describe, expect, it } from "vitest";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  formatarDataRelatorio,
  formatarQuantidadeCsv,
  gerarCsvDestinatarios,
  gerarCsvEntregas,
  gerarCsvExpedicoes,
  gerarCsvFornecedores,
  gerarCsvFuncionarios,
  gerarCsvMovimentacoes,
  gerarCsvProdutos,
  gerarCsvVencimento,
  limitesDoPeriodo,
  limitesDoPeriodoData,
  metadadosEmissao,
  normalizarFiltrosDestinatarios,
  normalizarFiltrosEntregas,
  normalizarFiltrosExpedicoes,
  normalizarFiltrosFornecedores,
  normalizarFiltrosFuncionarios,
  normalizarFiltrosMovimentacao,
  normalizarFiltrosProdutos,
  normalizarFiltrosVencimento,
  periodoSemestreAtual,
  rotuloDiasVencimento,
  rotuloSituacaoCadastro,
  rotuloStatusExpedicao,
  rotuloStatusNota,
  rotuloTipoDestinatario,
} from "@/services/relatorio";
import type {
  DestinatarioRelatorioRow,
  EntregaRelatorioRow,
  ExpedicaoRelatorioRow,
  FornecedorRelatorioRow,
  FuncionarioRelatorioRow,
  MovimentacaoRelatorioRow,
  ProdutoRelatorioRow,
  ProdutoVencimentoRelatorioRow,
} from "@/dao/relatorio";

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
        id_produtos: [],
        id_destinatarios: [],
        id_fornecedores: [],
        tipos: [],
      });
    });

    it("considera o dia local de São Paulo na virada do mês", () => {
      // 2026-11-01T02:30Z ainda é 31/10 às 23:30 em São Paulo.
      expect(
        normalizarFiltrosMovimentacao({}, new Date("2026-11-01T02:30:00.000Z")),
      ).toMatchObject({ de: "2026-10-01", ate: "2026-10-31" });
    });

    it("aceita período e listas de ids/tipos, repetidos ou separados por vírgula", () => {
      expect(
        normalizarFiltrosMovimentacao({
          de: "2026-09-01",
          ate: "2026-09-30",
          produto: "7,8",
          destinatario: ["3", "4,3"],
          fornecedor: ["5", "6"],
          tipo: ["saida", "entrada"],
        }),
      ).toEqual({
        de: "2026-09-01",
        ate: "2026-09-30",
        id_produtos: [7, 8],
        id_destinatarios: [3, 4],
        id_fornecedores: [5, 6],
        tipos: ["saida", "entrada"],
      });
    });

    it("ignora data, ids e tipos inválidos", () => {
      expect(
        normalizarFiltrosMovimentacao(
          {
            de: "2026-02-30",
            ate: "ontem",
            produto: "abc,0",
            destinatario: "0",
            fornecedor: "-2,3",
            tipo: "qualquer",
          },
          new Date("2026-10-24T15:30:00.000Z"),
        ),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_produtos: [],
        id_destinatarios: [],
        id_fornecedores: [3],
        tipos: [],
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

  describe("normalizarFiltrosExpedicoes", () => {
    it("usa o mês corrente e todas como padrão", () => {
      expect(
        normalizarFiltrosExpedicoes({}, new Date("2026-10-24T15:30:00.000Z")),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_expedicoes: [],
        id_destinatarios: [],
        id_condutores: [],
        status: [],
      });
    });

    it("aceita período e listas de ids/status, repetidos ou separados por vírgula", () => {
      expect(
        normalizarFiltrosExpedicoes({
          de: "2026-09-01",
          ate: "2026-09-30",
          expedicao: "4,5",
          destinatario: ["3", "5"],
          condutor: "7",
          status: ["EM_PERCURSO", "CONCLUIDA"],
        }),
      ).toEqual({
        de: "2026-09-01",
        ate: "2026-09-30",
        id_expedicoes: [4, 5],
        id_destinatarios: [3, 5],
        id_condutores: [7],
        status: ["EM_PERCURSO", "CONCLUIDA"],
      });
    });

    it("ignora data, ids e status inválidos", () => {
      expect(
        normalizarFiltrosExpedicoes(
          {
            de: "2026-02-30",
            ate: "ontem",
            expedicao: "abc",
            destinatario: "0",
            condutor: "-2",
            status: "qualquer,todas",
          },
          new Date("2026-10-24T15:30:00.000Z"),
        ),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_expedicoes: [],
        id_destinatarios: [],
        id_condutores: [],
        status: [],
      });
    });
  });

  describe("normalizarFiltrosEntregas", () => {
    it("usa o mês corrente e todos como padrão", () => {
      expect(
        normalizarFiltrosEntregas({}, new Date("2026-10-24T15:30:00.000Z")),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_destinatarios: [],
        status: [],
      });
    });

    it("aceita período, destinatários e status, repetidos ou separados por vírgula", () => {
      expect(
        normalizarFiltrosEntregas({
          de: "2026-09-01",
          ate: "2026-09-30",
          destinatario: ["8", "9,8"],
          status: ["BAIXA_PARCIAL", "PENDENTE"],
        }),
      ).toEqual({
        de: "2026-09-01",
        ate: "2026-09-30",
        id_destinatarios: [8, 9],
        status: ["BAIXA_PARCIAL", "PENDENTE"],
      });
    });

    it("ignora data, destinatários e status inválidos", () => {
      expect(
        normalizarFiltrosEntregas(
          {
            de: "2026-13-01",
            ate: "amanhã",
            destinatario: "abc",
            status: "qualquer",
          },
          new Date("2026-10-24T15:30:00.000Z"),
        ),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_destinatarios: [],
        status: [],
      });
    });
  });

  describe("Expedições e Entregas — formatação e CSV", () => {
    it("converte o período de uma coluna DATE para meia-noite UTC", () => {
      const limites = limitesDoPeriodoData({ de: "2026-10-01", ate: "2026-10-31" });

      expect(limites.de.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(limites.ate.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    });

    it("formata data no fuso de São Paulo e rótulos de status", () => {
      expect(formatarDataRelatorio(new Date("2026-10-24T15:30:00.000Z"))).toBe(
        "24/10/2026",
      );
      expect(rotuloStatusExpedicao("EM_PERCURSO")).toBe("Em percurso");
      expect(rotuloStatusNota("BAIXA_COM_CORTE")).toBe("Baixa com corte");
    });

    it("gera o CSV de Expedições com BOM, ponto e vírgula e decimal com vírgula", () => {
      const expedicao: ExpedicaoRelatorioRow = {
        id_expedicao: 7,
        data_prevista: "2026-10-05",
        status: "Concluída",
        veiculo: "AAA1111",
        condutor: "Ana Condutora",
        notas: 2,
        destinatarios: "Escola A, Escola B",
        itens_esperados: 15,
        itens_entregues: 10.5,
      };

      const csv = gerarCsvExpedicoes([expedicao]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFData prevista;Status;Veículo;Condutor;Notas;Destinatários;Itens esperados;Itens entregues\r\n" +
          "05/10/2026;Concluída;AAA1111;Ana Condutora;2;Escola A, Escola B;15;10,5\r\n",
      );
    });

    it("gera o CSV de Entregas com BOM, ponto e vírgula e decimal com vírgula", () => {
      const entrega: EntregaRelatorioRow = {
        id_nota_saida: 12,
        codigo: "000012",
        data: new Date("2026-10-10T12:00:00.000Z"),
        destinatario: "Escola Municipal",
        status: "Baixa parcial",
        itens: 2,
        esperado: 15,
        entregue: 6,
        pendente: 9,
        expedicao: "EXP #3",
      };

      const csv = gerarCsvEntregas([entrega]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFNota;Data;Destinatário;Status;Itens;Esperado;Entregue;Pendente;Expedição\r\n" +
          "000012;10/10/2026;Escola Municipal;Baixa parcial;2;15;6;9;EXP #3\r\n",
      );
    });

    it("protege campos especiais no CSV de Entregas", () => {
      const csv = gerarCsvEntregas([
        {
          id_nota_saida: 13,
          codigo: "000013",
          data: new Date("2026-10-11T12:00:00.000Z"),
          destinatario: 'Escola "Central"; anexo',
          status: "Aberta",
          itens: 0,
          esperado: 0,
          entregue: 0,
          pendente: 0,
          expedicao: "—",
        },
      ]);

      expect(csv).toContain('"Escola ""Central""; anexo"');
    });
  });

  describe("normalizarFiltrosVencimento", () => {
    it("usa 30 dias como padrão e aceita os limites válidos e todos", () => {
      expect(normalizarFiltrosVencimento()).toEqual({ dias: 30 });
      expect(normalizarFiltrosVencimento({ dias: "60" })).toEqual({ dias: 60 });
      expect(normalizarFiltrosVencimento({ dias: ["120"] })).toEqual({ dias: 120 });
      expect(normalizarFiltrosVencimento({ dias: "todos" })).toEqual({ dias: "todos" });
    });

    it("ignora limite desconhecido ou vazio e cai em 30 dias", () => {
      expect(normalizarFiltrosVencimento({ dias: "15" }).dias).toBe(30);
      expect(normalizarFiltrosVencimento({ dias: "" }).dias).toBe(30);
      expect(normalizarFiltrosVencimento({ dias: "abc" }).dias).toBe(30);
    });
  });

  describe("normalizarFiltros dos cadastros", () => {
    it("normaliza a situação de funcionários e fornecedores (vazio não filtra)", () => {
      expect(normalizarFiltrosFuncionarios()).toEqual({ situacoes: [] });
      expect(normalizarFiltrosFuncionarios({ situacao: "inativos" })).toEqual({
        situacoes: ["inativos"],
      });
      expect(
        normalizarFiltrosFuncionarios({ situacao: ["ativos", "inativos", "ativos"] }),
      ).toEqual({ situacoes: ["ativos", "inativos"] });
      expect(normalizarFiltrosFuncionarios({ situacao: "qualquer" })).toEqual({
        situacoes: [],
      });
      expect(normalizarFiltrosFornecedores({ situacao: "ativos" })).toEqual({
        situacoes: ["ativos"],
      });
    });

    it("normaliza situação e tipo dos destinatários", () => {
      expect(normalizarFiltrosDestinatarios()).toEqual({ situacoes: [], tipos: [] });
      expect(
        normalizarFiltrosDestinatarios({
          situacao: "ativos",
          tipo: ["CRECHE", "ESCOLA", "CRECHE", "qualquer"],
        }),
      ).toEqual({ situacoes: ["ativos"], tipos: ["CRECHE", "ESCOLA"] });
    });

    it("rotula as opções dos filtros", () => {
      expect(rotuloSituacaoCadastro("ativos")).toBe("Ativos");
      expect(rotuloTipoDestinatario("CRECHE")).toBe("Creche");
      expect(rotuloDiasVencimento(30)).toBe("30 dias");
      expect(rotuloDiasVencimento("todos")).toBe("Todos");
    });
  });

  describe("CSV dos cadastros e do vencimento", () => {
    it("gera o CSV de vencimento com validade, dias restantes e situação", () => {
      const linhaVencimento: ProdutoVencimentoRelatorioRow = {
        id_produto: 1,
        codigo: "000001",
        descricao: "Leite",
        unidade: "CX",
        quantidade: 10.5,
        validade: "2026-10-20",
        dias_restantes: -4,
        situacao: "Vencido (4)",
      };

      const csv = gerarCsvVencimento([linhaVencimento]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Produto;Unidade;Quantidade;Validade;Dias restantes;Situação\r\n" +
          "000001;Leite;CX;10,5;20/10/2026;-4;Vencido (4)\r\n",
      );
    });

    it("gera o CSV de funcionários com condutor e contato principal", () => {
      const funcionario: FuncionarioRelatorioRow = {
        id_funcionario: 1,
        codigo: "000001",
        nome: "Ana",
        cpf: "11111111111",
        cargo: "Conferente",
        condutor: true,
        situacao: "Ativo",
        email: "ana@nexus.test",
        telefone: "21999990001",
      };

      const csv = gerarCsvFuncionarios([funcionario]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Nome;CPF;Cargo;Condutor;Situação;E-mail;Telefone\r\n" +
          "000001;Ana;11111111111;Conferente;Sim;Ativo;ana@nexus.test;21999990001\r\n",
      );
    });

    it("gera o CSV de destinatários com tipo, endereço e contato", () => {
      const destinatario: DestinatarioRelatorioRow = {
        id_destinatario: 1,
        codigo: "000001",
        razao_social: "Escola A",
        cnpj: "11222333000181",
        tipo: "Escola",
        situacao: "Ativo",
        endereco: "Rua A, 10 - Centro - Rio de Janeiro",
        email: "escola@nexus.test",
        telefone: "2133334444",
      };

      const csv = gerarCsvDestinatarios([destinatario]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Razão social;CNPJ;Tipo;Situação;Endereço;E-mail;Telefone\r\n" +
          "000001;Escola A;11222333000181;Escola;Ativo;Rua A, 10 - Centro - Rio de Janeiro;escola@nexus.test;2133334444\r\n",
      );
    });

    it("gera o CSV de fornecedores e deixa vazios os dados ausentes", () => {
      const fornecedor: FornecedorRelatorioRow = {
        id_fornecedor: 2,
        codigo: "000002",
        razao_social: "Fornecedor B",
        cnpj: null,
        situacao: "Inativo",
        endereco: "—",
        email: null,
        telefone: null,
      };

      const csv = gerarCsvFornecedores([fornecedor]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Razão social;CNPJ;Situação;Endereço;E-mail;Telefone\r\n" +
          "000002;Fornecedor B;;Inativo;—;;\r\n",
      );
    });
  });
});
