import { describe, expect, it } from "vitest";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  formatarDataRelatorio,
  formatarQuantidadeCsv,
  gerarCsvAuditoria,
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
  normalizarFiltrosAuditoria,
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
  tabelaAuditoria,
  tabelaDestinatarios,
  tabelaEntregas,
  tabelaExpedicoes,
  tabelaFuncionarios,
  tabelaFornecedores,
  tabelaMovimentacoes,
  tabelaProdutos,
  tabelaVencimento,
} from "@/services/relatorio";
import type {
  AuditoriaRelatorioRow,
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
  quantidade: 10,
  reservado: 2.5,
  livre: 7.5,
  situacao: "Ativo",
  unidade_entrada: "UNIDADE",
  unidade_saida: "UNIDADE",
  codigos: [],
  foto_url: null,
};

describe("serviço de relatórios", () => {
  describe("normalizarFiltrosProdutos", () => {
    it("usa ativas como padrão", () => {
      expect(normalizarFiltrosProdutos()).toEqual({
        situacao: "ativas",
        fotos: false,
        codigos: false,
      });
    });

    it("aceita situação válida, inclusive em array, e ignora valor inválido", () => {
      expect(normalizarFiltrosProdutos({ situacao: "todas" }).situacao).toBe("todas");
      expect(normalizarFiltrosProdutos({ situacao: ["inativas", "todas"] }).situacao).toBe(
        "inativas",
      );
      expect(normalizarFiltrosProdutos({ situacao: "qualquer" }).situacao).toBe("ativas");
      expect(normalizarFiltrosProdutos({ fotos: "1" }).fotos).toBe(true);
      expect(normalizarFiltrosProdutos({ codigos: "1" }).codigos).toBe(true);
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
        "\uFEFFCódigo;Descrição;Quantidade;Qtd. Livre;Situação\r\n" +
          "000001;Arroz;10;7,5;Ativo\r\n",
      );
    });

    it("protege campos com ponto e vírgula, aspas e quebra de linha", () => {
      const csv = gerarCsvProdutos([
        { ...linha, descricao: 'Arroz "tipo 1"; integral\nrefinado' },
      ]);

      expect(csv).toContain('"Arroz ""tipo 1""; integral\nrefinado"');
    });

    it("inclui a coluna Foto somente quando solicitado", () => {
      const comFoto = gerarCsvProdutos(
        [{ ...linha, foto_url: "/uploads/produtos/1/foto.webp" }],
        true,
      );
      expect(comFoto).toContain("Situação;Foto");
      expect(comFoto).toContain("/uploads/produtos/1/foto.webp");

      const semFoto = gerarCsvProdutos([linha], false);
      expect(semFoto).not.toContain("Foto");
    });

    it("inclui a coluna Códigos somente quando solicitado", () => {
      const comCodigos = gerarCsvProdutos(
        [
          {
            ...linha,
            codigos: [
              { tipo: "EAN13", codigo: "789" },
              { tipo: "COD_FORNECEDOR", codigo: "ABC-1" },
            ],
          },
        ],
        false,
        true,
      );
      expect(comCodigos).toContain("Situação;Códigos");
      expect(comCodigos).toContain("EAN13: 789 | COD_FORNECEDOR: ABC-1");

      const semCodigos = gerarCsvProdutos([linha], false, false);
      expect(semCodigos).not.toContain("Códigos");
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
        fotos: false,
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
        fotos: false,
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
        fotos: false,
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
        fotos: false,
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
        fotos: false,
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
        fotos: false,
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
        fotos: [],
      };

      const csv = gerarCsvExpedicoes([expedicao]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFData prevista;Status;Veículo;Condutor;Notas;Destinatários;Itens solicitados;Itens entregues\r\n" +
          "05/10/2026;Concluída;AAA1111;Ana Condutora;2;Escola A, Escola B;15;10,5\r\n",
      );

      const comFotos = gerarCsvExpedicoes(
        [{ ...expedicao, fotos: ["/uploads/entregas/1/2/a.webp", "/uploads/entregas/1/2/b.webp"] }],
        true,
      );
      expect(comFotos).toContain("Itens entregues;Fotos");
      expect(comFotos).toContain(
        "/uploads/entregas/1/2/a.webp;/uploads/entregas/1/2/b.webp",
      );
    });

    it("gera o CSV de Entregas com BOM, ponto e vírgula e decimal com vírgula", () => {
      const entrega: EntregaRelatorioRow = {
        id_nota_saida: 12,
        id_destinatario: 3,
        codigo: "000012",
        data: new Date("2026-10-10T12:00:00.000Z"),
        destinatario: "Escola Municipal",
        status: "Baixa parcial",
        itens: 2,
        esperado: 15,
        entregue: 6,
        pendente: 9,
        expedicao: "EXP #3",
        fotos: [],
        justificativa: null,
      };

      const csv = gerarCsvEntregas([entrega]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFNota;Data;Destinatário;Status;Itens;Solicitado;Entregue;Pendente;Expedição\r\n" +
          "000012;10/10/2026;Escola Municipal;Baixa parcial;2;15;6;9;EXP #3\r\n",
      );

      const comFotos = gerarCsvEntregas(
        [
          {
            ...entrega,
            fotos: ["/uploads/entregas/1/12/a.webp"],
            justificativa: "Escola fechada",
          },
        ],
        true,
      );
      expect(comFotos).toContain("Expedição;Fotos;Justificativa");
      expect(comFotos).toContain("/uploads/entregas/1/12/a.webp;Escola fechada");
    });

    it("protege campos especiais no CSV de Entregas", () => {
      const csv = gerarCsvEntregas([
        {
          id_nota_saida: 13,
          id_destinatario: 3,
          codigo: "000013",
          data: new Date("2026-10-11T12:00:00.000Z"),
          destinatario: 'Escola "Central"; anexo',
          status: "Aberta",
          itens: 0,
          esperado: 0,
          entregue: 0,
          pendente: 0,
          expedicao: "—",
          fotos: [],
          justificativa: null,
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
      expect(normalizarFiltrosFuncionarios()).toEqual({
        situacoes: [],
        fotos: false,
        codigos: false,
        contatos: false,
      });
      expect(
        normalizarFiltrosFuncionarios({
          situacao: "inativos",
          fotos: "1",
          codigos: "1",
          contatos: "1",
        }),
      ).toEqual({
        situacoes: ["inativos"],
        fotos: true,
        codigos: true,
        contatos: true,
      });
      expect(
        normalizarFiltrosFuncionarios({ situacao: ["ativos", "inativos", "ativos"] }),
      ).toEqual({
        situacoes: ["ativos", "inativos"],
        fotos: false,
        codigos: false,
        contatos: false,
      });
      expect(normalizarFiltrosFuncionarios({ situacao: "qualquer" })).toEqual({
        situacoes: [],
        fotos: false,
        codigos: false,
        contatos: false,
      });
      expect(normalizarFiltrosFornecedores({ situacao: "ativos" })).toEqual({
        situacoes: ["ativos"],
        codigos: false,
        contatos: false,
      });
    });

    it("normaliza situação e tipo dos destinatários", () => {
      expect(normalizarFiltrosDestinatarios()).toEqual({
        situacoes: [],
        tipos: [],
        codigos: false,
        contatos: false,
      });
      expect(
        normalizarFiltrosDestinatarios({
          situacao: "ativos",
          tipo: ["12", "7", "12", "qualquer", "0", "-3"],
          codigos: "1",
          contatos: "1",
        }),
      ).toEqual({
        situacoes: ["ativos"],
        tipos: [12, 7],
        codigos: true,
        contatos: true,
      });
    });

    it("rotula as opções dos filtros", () => {
      expect(rotuloSituacaoCadastro("ativos")).toBe("Ativos");
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
        quantidade: 10.5,
        validade: "2026-10-20",
        dias_restantes: -4,
        situacao: "Vencido (4)",
      };

      const csv = gerarCsvVencimento([linhaVencimento]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Produto;Quantidade;Validade;Dias restantes;Situação\r\n" +
          "000001;Leite;10,5;20/10/2026;-4;Vencido (4)\r\n",
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
        emails: [],
        telefones: [],
        codigos: [],
        foto_url: null,
      };

      const csv = gerarCsvFuncionarios([funcionario]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Nome;CPF;Cargo;Condutor;Situação;E-mail;Telefone\r\n" +
          "000001;Ana;11111111111;Conferente;Sim;Ativo;ana@nexus.test;21999990001\r\n",
      );

      const comFoto = gerarCsvFuncionarios(
        [{ ...funcionario, foto_url: "/uploads/funcionarios/1/foto.webp" }],
        true,
      );
      expect(comFoto).toContain("Telefone;Foto");
      expect(comFoto).toContain("/uploads/funcionarios/1/foto.webp");
    });

    it("substitui E-mail/Telefone por E-mails/Telefones no CSV de funcionários", () => {
      const csv = gerarCsvFuncionarios(
        [
          {
            id_funcionario: 1,
            codigo: "000001",
            nome: "Ana",
            cpf: null,
            cargo: null,
            condutor: false,
            situacao: "Ativo",
            email: "ana@nexus.test",
            telefone: "21999990001",
            emails: [
              { endereco: "ana@nexus.test", principal: true },
              { endereco: "ana.secundaria@nexus.test", principal: false },
            ],
            telefones: [
              { numero: "21999990001", tipo: "CELULAR", principal: true },
              { numero: "2133334444", tipo: "COMERCIAL", principal: false },
            ],
            codigos: [],
            foto_url: null,
          },
        ],
        false,
        false,
        true,
      );

      expect(csv).toContain("Situação;E-mails;Telefones");
      expect(csv).toContain("ana@nexus.test (principal) | ana.secundaria@nexus.test");
      expect(csv).toContain(
        "(21) 99999-0001 (Celular, principal) | (21) 3333-4444 (Comercial)",
      );
      expect(csv).not.toContain("E-mail;Telefone");
    });

    it("gera o CSV de destinatários com tipo, endereço e contato", () => {
      const destinatario: DestinatarioRelatorioRow = {
        id_destinatario: 1,
        codigo: "000001",
        razao_social: "Escola A",
        cnpj: "11222333000181",
        tipo_nome: "Escola",
        situacao: "Ativo",
        endereco: "Rua A, 10 - Centro - Rio de Janeiro",
        email: "escola@nexus.test",
        telefone: "2133334444",
        emails: [],
        telefones: [],
        codigos: [],
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
        emails: [],
        telefones: [],
        codigos: [],
      };

      const csv = gerarCsvFornecedores([fornecedor]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFCódigo;Razão social;CNPJ;Situação;Endereço;E-mail;Telefone\r\n" +
          "000002;Fornecedor B;;Inativo;—;;\r\n",
      );
    });

    it("anexa a coluna Códigos ao final do CSV dos cadastros", () => {
      const comCodigos = gerarCsvFuncionarios(
        [
          {
            id_funcionario: 1,
            codigo: "000001",
            nome: "Ana",
            cpf: null,
            cargo: null,
            condutor: false,
            situacao: "Ativo",
            email: null,
            telefone: null,
            emails: [],
            telefones: [],
            codigos: [{ tipo: "MATRICULA", codigo: "12345" }],
            foto_url: null,
          },
        ],
        false,
        true,
      );
      expect(comCodigos).toContain("Telefone;Códigos");
      expect(comCodigos).toContain("MATRICULA: 12345");

      const destinatario = gerarCsvDestinatarios(
        [
          {
            id_destinatario: 1,
            codigo: "000001",
            razao_social: "Escola A",
            cnpj: null,
            tipo_nome: "Escola",
            situacao: "Ativo",
            endereco: "Rua A",
            email: null,
            telefone: null,
            emails: [],
            telefones: [],
            codigos: [{ tipo: "COD_ESCOLA", codigo: "ESC-9" }],
          },
        ],
        true,
      );
      expect(destinatario).toContain("Telefone;Códigos");
      expect(destinatario).toContain("COD_ESCOLA: ESC-9");

      const fornecedor = gerarCsvFornecedores(
        [
          {
            id_fornecedor: 1,
            codigo: "000001",
            razao_social: "Fornecedor A",
            cnpj: null,
            situacao: "Ativo",
            endereco: "—",
            email: null,
            telefone: null,
            emails: [],
            telefones: [],
            codigos: [{ tipo: "DIGITACAO", codigo: "F-1" }],
          },
        ],
        true,
      );
      expect(fornecedor).toContain("Telefone;Códigos");
      expect(fornecedor).toContain("DIGITACAO: F-1");
    });

    it("substitui E-mail/Telefone por E-mails/Telefones no CSV dos cadastros", () => {
      const destinatario = gerarCsvDestinatarios(
        [
          {
            id_destinatario: 1,
            codigo: "000001",
            razao_social: "Escola A",
            cnpj: null,
            tipo_nome: "Escola",
            situacao: "Ativo",
            endereco: "Rua A",
            email: "escola@nexus.test",
            telefone: "2133334444",
            emails: [
              { endereco: "escola@nexus.test", principal: true },
              { endereco: "secretaria@nexus.test", principal: false },
            ],
            telefones: [
              { numero: "2133334444", tipo: "COMERCIAL", principal: true },
              { numero: "21999990000", tipo: "CELULAR", principal: false },
            ],
            codigos: [{ tipo: "COD_ESCOLA", codigo: "ESC-9" }],
          },
        ],
        true,
        true,
      );

      expect(destinatario).toContain("Endereço;E-mails;Telefones;Códigos");
      expect(destinatario).not.toContain("E-mail;Telefone");
      expect(destinatario).toContain(
        "escola@nexus.test (principal) | secretaria@nexus.test",
      );
      expect(destinatario).toContain(
        "(21) 3333-4444 (Comercial, principal) | (21) 99999-0000 (Celular)",
      );

      const fornecedor = gerarCsvFornecedores(
        [
          {
            id_fornecedor: 1,
            codigo: "000001",
            razao_social: "Fornecedor A",
            cnpj: null,
            situacao: "Ativo",
            endereco: "—",
            email: null,
            telefone: null,
            emails: [{ endereco: "fornecedor@nexus.test", principal: true }],
            telefones: [
              { numero: "2144445555", tipo: "COMERCIAL", principal: true },
            ],
            codigos: [],
          },
        ],
        false,
        true,
      );
      expect(fornecedor).toContain("Endereço;E-mails;Telefones");
      expect(fornecedor).toContain("fornecedor@nexus.test (principal)");
      expect(fornecedor).toContain("(21) 4444-5555 (Comercial, principal)");
    });
  });

  describe("Auditoria — filtros e CSV", () => {
    it("usa o mês corrente e listas vazias como padrão", () => {
      expect(
        normalizarFiltrosAuditoria({}, new Date("2026-10-24T15:30:00.000Z")),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_usuarios: [],
        entidades: [],
        acoes: [],
      });
    });

    it("aceita período, usuários, entidades e ações, repetidos ou separados por vírgula", () => {
      expect(
        normalizarFiltrosAuditoria({
          de: "2026-09-01",
          ate: "2026-09-30",
          usuario: ["3", "4,3"],
          entidade: ["Produto", "Usuario", "Produto"],
          acao: ["CRIAR", "ALTERAR,CRIAR"],
        }),
      ).toEqual({
        de: "2026-09-01",
        ate: "2026-09-30",
        id_usuarios: [3, 4],
        entidades: ["Produto", "Usuario"],
        acoes: ["CRIAR", "ALTERAR"],
      });
    });

    it("ignora data e ids inválidos e descarta textos vazios", () => {
      expect(
        normalizarFiltrosAuditoria(
          {
            de: "2026-13-01",
            ate: "amanhã",
            usuario: "abc",
            entidade: " , ",
            acao: "",
          },
          new Date("2026-10-24T15:30:00.000Z"),
        ),
      ).toEqual({
        de: "2026-10-01",
        ate: "2026-10-31",
        id_usuarios: [],
        entidades: [],
        acoes: [],
      });
    });

    it("gera o CSV com BOM, cabeçalho, separador e registro afetado", () => {
      const linha: AuditoriaRelatorioRow = {
        id_registro_auditoria: 7,
        data_hora: new Date("2026-10-24T15:30:00.000Z"),
        usuario: "Ana Auditora",
        acao: "ALTERAR",
        entidade: "Produto",
        id_entidade_afetada: 10,
        dados_anteriores: null,
        dados_novos: null,
      };
      const semRegistro: AuditoriaRelatorioRow = {
        ...linha,
        id_registro_auditoria: 8,
        data_hora: new Date("2026-10-24T16:45:00.000Z"),
        usuario: "sem_nome",
        acao: "LOGIN",
        entidade: "Usuario",
        id_entidade_afetada: null,
      };

      const csv = gerarCsvAuditoria([linha, semRegistro]);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toBe(
        "\uFEFFData/hora;Usuário;Ação;Entidade;Registro;Descrição;Alterações\r\n" +
          "24/10/2026 12:30;Ana Auditora;Alterar;Produto;#10;;\r\n" +
          "24/10/2026 13:45;sem_nome;Login;Usuário;—;;\r\n",
      );
    });

    it("inclui descrição e o diff redigido na coluna Alterações", () => {
      const linha: AuditoriaRelatorioRow = {
        id_registro_auditoria: 9,
        data_hora: new Date("2026-10-24T17:00:00.000Z"),
        usuario: "Ana Auditora",
        acao: "ALTERAR",
        entidade: "Usuario",
        id_entidade_afetada: 3,
        dados_anteriores: { nome: "Ana", senha_hash: "hash-antigo" },
        dados_novos: { nome: "Ana Paula", senha_hash: "hash-novo" },
      };

      const csv = gerarCsvAuditoria([linha]);

      expect(csv).toContain("Registro;Descrição;Alterações");
      expect(csv).toContain("Ana Paula");
      expect(csv).toContain(
        "Nome: Ana → Ana Paula | Senha: [oculto] → [oculto]",
      );
      expect(csv).not.toContain("hash-antigo");
      expect(csv).not.toContain("hash-novo");
    });

    it("não mostra diff em eventos de autenticação", () => {
      const linha: AuditoriaRelatorioRow = {
        id_registro_auditoria: 11,
        data_hora: new Date("2026-10-24T19:00:00.000Z"),
        usuario: "Enzo",
        acao: "LOGIN",
        entidade: "Usuario",
        id_entidade_afetada: 3,
        dados_anteriores: { login: "enzo@email.com" },
        dados_novos: {},
      };

      const csv = gerarCsvAuditoria([linha]);

      expect(csv).toContain("enzo@email.com");
      expect(csv).not.toContain("Login:");
      expect(csv).not.toContain("→");
    });

    it("descreve coleções no CSV com grupo, item e referência", () => {
      const linha: AuditoriaRelatorioRow = {
        id_registro_auditoria: 10,
        data_hora: new Date("2026-10-24T18:00:00.000Z"),
        usuario: "Ana Auditora",
        acao: "ALTERAR",
        entidade: "NotaSaida",
        id_entidade_afetada: 1,
        dados_anteriores: {
          itens: [{ id_item_nota_saida: 34, qtd_entregue: 0 }],
        },
        dados_novos: {
          itens: [{ id_item_nota_saida: 34, qtd_entregue: 4 }],
        },
      };
      const referencias = new Map([
        ["item_nota_saida:34", "Lápis de cor"],
        ["nota_saida:1", "Escola A"],
      ]);

      const csv = gerarCsvAuditoria([linha], referencias);

      expect(csv).toContain("Escola A");
      expect(csv).toContain(
        "Itens · Item #34 · Lápis de cor · Qtd. entregue: 0 → 4",
      );
    });
  });

  describe("tabelas para XLSX", () => {
    it("tabela de produtos mantém o cabeçalho e as quantidades numéricas", () => {
      const tabela = tabelaProdutos([linha]);

      expect(tabela.cabecalho).toEqual([
        "Código",
        "Descrição",
        "Quantidade",
        "Qtd. Livre",
        "Situação",
      ]);
      expect(tabela.registros[0]![2]).toBe(10);
      expect(tabela.registros[0]![3]).toBe(7.5);
      expect(typeof tabela.registros[0]![2]).toBe("number");
    });

    it("tabela de movimentação mantém os saldos numéricos e o travessão do nulo", () => {
      const tabela = tabelaMovimentacoes([
        {
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
        },
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
          observacao: null,
        },
      ]);

      expect(tabela.cabecalho).toHaveLength(10);
      expect(tabela.registros[0]![5]).toBe(10.5);
      expect(tabela.registros[0]![6]).toBe(0);
      expect(tabela.registros[0]![7]).toBe(10.5);
      expect(tabela.registros[0]![9]).toBeNull();
      expect(tabela.registros[1]![6]).toBe("—");
      expect(tabela.registros[1]![7]).toBe("—");
    });

    it("tabelas de expedições e entregas usam números nativos", () => {
      const expedicoes = tabelaExpedicoes([
        {
          id_expedicao: 7,
          data_prevista: "2026-10-05",
          status: "Concluída",
          veiculo: "AAA1111",
          condutor: "Ana Condutora",
          notas: 2,
          destinatarios: "Escola A, Escola B",
          itens_esperados: 15,
          itens_entregues: 10.5,
          fotos: [],
        },
      ]);
      expect(expedicoes.registros[0]![4]).toBe(2);
      expect(expedicoes.registros[0]![6]).toBe(15);
      expect(expedicoes.registros[0]![7]).toBe(10.5);

      const entregas = tabelaEntregas([
        {
          id_nota_saida: 12,
          id_destinatario: 3,
          codigo: "000012",
          data: new Date("2026-10-10T12:00:00.000Z"),
          destinatario: "Escola Municipal",
          status: "Baixa parcial",
          itens: 2,
          esperado: 15,
          entregue: 6,
          pendente: 9,
          expedicao: "EXP #3",
          fotos: [],
          justificativa: null,
        },
      ]);
      expect(entregas.registros[0]![4]).toBe(2);
      expect(entregas.registros[0]![5]).toBe(15);
      expect(entregas.registros[0]![6]).toBe(6);
      expect(entregas.registros[0]![7]).toBe(9);
    });

    it("tabela de vencimento mantém dias restantes numérico", () => {
      const tabela = tabelaVencimento([
        {
          id_produto: 1,
          codigo: "000001",
          descricao: "Leite",
          quantidade: 10.5,
          validade: "2026-10-20",
          dias_restantes: -4,
          situacao: "Vencido (4)",
        },
      ]);

      expect(tabela.registros[0]![2]).toBe(10.5);
      expect(tabela.registros[0]![4]).toBe(-4);
    });

    it("tabelas dos cadastros e da auditoria mantêm as colunas do CSV", () => {
      const funcionarios = tabelaFuncionarios([
        {
          id_funcionario: 1,
          codigo: "000001",
          nome: "Ana",
          cpf: null,
          cargo: null,
          condutor: true,
          situacao: "Ativo",
          email: null,
          telefone: null,
          emails: [],
          telefones: [],
          codigos: [],
          foto_url: null,
        },
      ]);
      expect(funcionarios.cabecalho).toEqual([
        "Código",
        "Nome",
        "CPF",
        "Cargo",
        "Condutor",
        "Situação",
        "E-mail",
        "Telefone",
      ]);
      expect(funcionarios.registros[0]![4]).toBe("Sim");
      expect(funcionarios.registros[0]![6]).toBeNull();

      expect(tabelaDestinatarios([]).cabecalho).toContain("Razão social");
      expect(tabelaFornecedores([]).cabecalho).toContain("Endereço");

      const auditoria = tabelaAuditoria([
        {
          id_registro_auditoria: 7,
          data_hora: new Date("2026-10-24T15:30:00.000Z"),
          usuario: "Ana Auditora",
          acao: "ALTERAR",
          entidade: "Produto",
          id_entidade_afetada: 10,
          dados_anteriores: null,
          dados_novos: null,
        },
      ]);
      expect(auditoria.cabecalho).toEqual([
        "Data/hora",
        "Usuário",
        "Ação",
        "Entidade",
        "Registro",
        "Descrição",
        "Alterações",
      ]);
      expect(auditoria.registros[0]![4]).toBe("#10");
      expect(auditoria.registros[0]![5]).toBeNull();
    });
  });
});
