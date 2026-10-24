import { describe, expect, it } from "vitest";
import { relatorioDAO } from "@/dao/relatorio";
import { prismaTeste } from "../helpers/prisma";
import {
  criarEstoque,
  criarExpedicao,
  criarFuncionario,
  criarMovimentacao,
  criarDestinatario,
  criarFornecedor,
  criarNotaEntrada,
  criarNotaSaida,
  criarProduto,
  criarUsuario,
  criarConversao,
  criarVeiculo,
} from "../helpers/factories";

/** Vínculo nota ↔ expedição, com data de adição explícita para testar o "mais recente". */
async function vincularNota(
  idExpedicao: number,
  idNotaSaida: number,
  ordemVisita = 1,
  dataAdicao = new Date(),
) {
  return prismaTeste.expedicaoNota.create({
    data: {
      id_expedicao: idExpedicao,
      id_nota_saida: idNotaSaida,
      ordem_visita: ordemVisita,
      data_adicao: dataAdicao,
    },
  });
}

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

    it("devolve listas vazias e totais zerados sem produtos", async () => {
      const resultado = await relatorioDAO.listarProdutosRelatorio();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ quantidade: 0, livre: 0 });
    });
  });

  describe("listarMovimentacoes", () => {
    it("filtra o período inclusivo, ordena por data e soma entradas e saídas", async () => {
      const { usuario } = await criarUsuario({ nome: "Maria Operadora" });
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);
      const entrada = await criarNotaEntrada();
      const saida = await criarNotaSaida();

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        saldoAnterior: 0,
        saldoPosterior: 10,
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-15T12:00:00.000Z"),
        saldoAnterior: 10,
        saldoPosterior: 6,
        idNotaSaida: saida.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 2, {
        dataHora: new Date("2026-10-20T12:00:00.000Z"),
        saldoAnterior: 6,
        saldoPosterior: 8,
        observacao: "Ajuste de inventário",
      });
      // Fora do período: um segundo antes do início e um segundo depois do fim.
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 99, {
        dataHora: new Date("2026-09-30T23:59:59.000Z"),
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 99, {
        dataHora: new Date("2026-11-01T00:00:00.000Z"),
      });

      const resultado = await relatorioDAO.listarMovimentacoes({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T23:59:59.999Z"),
      });

      expect(resultado.data.map((m) => m.quantidade)).toEqual([10, -4, 2]);
      expect(resultado.data[0]).toMatchObject({
        id_produto: produto.id_produto,
        codigo: String(produto.id_produto).padStart(6, "0"),
        produto: "Arroz",
        tipo: "Entrada",
        documento: `NE #${entrada.id_nota_entrada}`,
        saldo_anterior: 0,
        saldo_posterior: 10,
        usuario: "Maria Operadora",
      });
      expect(resultado.data[1]).toMatchObject({
        tipo: "Saída",
        documento: `NS #${saida.id_nota_saida}`,
        saldo_anterior: 10,
        saldo_posterior: 6,
      });
      expect(resultado.data[2]).toMatchObject({
        tipo: "Ajuste",
        documento: "—",
        destinatario_fornecedor: "—",
        observacao: "Ajuste de inventário",
      });
      expect(resultado.totais).toEqual({ entradas: 12, saidas: 4 });
    });

    it("traz o destinatário da saída e o fornecedor da entrada na linha", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto);
      const { destinatario } = await criarDestinatario({ razaoSocial: "Escola Municipal" });
      const { fornecedor } = await criarFornecedor({ razaoSocial: "Distribuidora Central" });
      const entrada = await criarNotaEntrada(fornecedor.id_fornecedor);
      const saida = await criarNotaSaida({ idDestinatario: destinatario.id_destinatario });

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saida.id_nota_saida,
      });

      const resultado = await relatorioDAO.listarMovimentacoes();

      expect(resultado.data.map((m) => m.destinatario_fornecedor)).toEqual([
        "Distribuidora Central",
        "Escola Municipal",
      ]);
    });

    it("filtra por destinatário e por fornecedor, restringindo às notas correspondentes", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto);
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const fornecedorA = await criarFornecedor({ razaoSocial: "Fornecedor A" });
      const fornecedorB = await criarFornecedor({ razaoSocial: "Fornecedor B" });
      const entrada = await criarNotaEntrada(fornecedorA.fornecedor.id_fornecedor);
      const saidaA = await criarNotaSaida({
        idDestinatario: escolaA.destinatario.id_destinatario,
      });
      const saidaB = await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saidaA.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -2, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
        idNotaSaida: saidaB.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 1, {
        dataHora: new Date("2026-10-04T12:00:00.000Z"),
      });

      const porDestinatario = await relatorioDAO.listarMovimentacoes({
        id_destinatario: escolaA.destinatario.id_destinatario,
      });
      expect(porDestinatario.data).toHaveLength(1);
      expect(porDestinatario.data[0]).toMatchObject({
        tipo: "Saída",
        quantidade: -4,
        destinatario_fornecedor: "Escola A",
      });
      expect(porDestinatario.totais).toEqual({ entradas: 0, saidas: 4 });

      const porFornecedor = await relatorioDAO.listarMovimentacoes({
        id_fornecedor: fornecedorA.fornecedor.id_fornecedor,
      });
      expect(porFornecedor.data).toHaveLength(1);
      expect(porFornecedor.data[0]).toMatchObject({
        tipo: "Entrada",
        quantidade: 10,
        destinatario_fornecedor: "Fornecedor A",
      });
      expect(porFornecedor.totais).toEqual({ entradas: 10, saidas: 0 });

      const semMovimentacao = await relatorioDAO.listarMovimentacoes({
        id_fornecedor: fornecedorB.fornecedor.id_fornecedor,
      });
      expect(semMovimentacao.data).toEqual([]);
      expect(semMovimentacao.totais).toEqual({ entradas: 0, saidas: 0 });
    });

    it("lista destinatários e fornecedores por nome, só ativos, mantendo o selecionado", async () => {
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaInativa = await criarDestinatario({
        razaoSocial: "Escola Inativa",
        ativo: false,
      });
      await criarFornecedor({ razaoSocial: "Fornecedor B" });
      await criarFornecedor({ razaoSocial: "Fornecedor A" });

      const destinatarios = await relatorioDAO.listarDestinatariosParaFiltro();
      expect(destinatarios.map((d) => d.nome)).toEqual(["Escola A", "Escola B"]);
      expect(destinatarios[1]?.id_destinatario).toBe(escolaB.destinatario.id_destinatario);

      const comInativa = await relatorioDAO.listarDestinatariosParaFiltro(
        escolaInativa.destinatario.id_destinatario,
      );
      expect(comInativa.map((d) => d.nome)).toEqual([
        "Escola A",
        "Escola B",
        "Escola Inativa",
      ]);

      const fornecedores = await relatorioDAO.listarFornecedoresParaFiltro();
      expect(fornecedores.map((f) => f.nome)).toEqual(["Fornecedor A", "Fornecedor B"]);
    });

    it("filtra por produto", async () => {
      const { usuario } = await criarUsuario();
      const arroz = await criarProduto({ descricao: "Arroz" });
      const feijao = await criarProduto({ descricao: "Feijão" });
      const estoqueArroz = await criarEstoque(arroz.id_produto);
      const estoqueFeijao = await criarEstoque(feijao.id_produto);

      await criarMovimentacao(estoqueArroz.id_estoque, usuario.id_usuario, 5, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
      });
      await criarMovimentacao(estoqueFeijao.id_estoque, usuario.id_usuario, 7, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
      });

      const resultado = await relatorioDAO.listarMovimentacoes({
        id_produto: feijao.id_produto,
      });

      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0]).toMatchObject({
        id_produto: feijao.id_produto,
        produto: "Feijão",
        quantidade: 7,
      });
      expect(resultado.totais).toEqual({ entradas: 7, saidas: 0 });
    });

    it("filtra por tipo entrada e saída, deixando o ajuste só em todos", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);
      const entrada = await criarNotaEntrada();
      const saida = await criarNotaSaida();

      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 10, {
        dataHora: new Date("2026-10-01T12:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, -3, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saida.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 1, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
      });

      const entradas = await relatorioDAO.listarMovimentacoes({ tipo: "entrada" });
      expect(entradas.data.map((m) => m.tipo)).toEqual(["Entrada"]);
      expect(entradas.totais).toEqual({ entradas: 10, saidas: 0 });

      const saidas = await relatorioDAO.listarMovimentacoes({ tipo: "saida" });
      expect(saidas.data.map((m) => m.tipo)).toEqual(["Saída"]);
      expect(saidas.totais).toEqual({ entradas: 0, saidas: 3 });

      const todos = await relatorioDAO.listarMovimentacoes({ tipo: "todos" });
      expect(todos.data.map((m) => m.tipo)).toEqual(["Entrada", "Saída", "Ajuste"]);
      expect(todos.totais).toEqual({ entradas: 11, saidas: 3 });
    });

    it("devolve lista vazia e totais zerados sem movimentações", async () => {
      const resultado = await relatorioDAO.listarMovimentacoes();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ entradas: 0, saidas: 0 });
    });
  });

  describe("listarExpedicoesRelatorio", () => {
    it("lista o período por data prevista decrescente, com notas, destinatários e itens", async () => {
      const veiculoA = await criarVeiculo({ placa: "AAA1111" });
      const veiculoB = await criarVeiculo({ placa: "BBB2222" });
      const { funcionario: condutorA } = await criarFuncionario({
        nome: "Ana Condutora",
        condutor: true,
      });
      const { funcionario: condutorB } = await criarFuncionario({
        nome: "Bruno Condutor",
        condutor: true,
      });
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);

      const notaA = await criarNotaSaida({
        idDestinatario: escolaA.destinatario.id_destinatario,
      });
      const notaB = await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });
      await prismaTeste.itemNotaSaida.create({
        data: {
          id_nota_saida: notaA.id_nota_saida,
          id_estoque: estoque.id_estoque,
          qtd_esperada: 10,
          qtd_entregue: 8,
        },
      });
      await prismaTeste.itemNotaSaida.create({
        data: {
          id_nota_saida: notaB.id_nota_saida,
          id_estoque: estoque.id_estoque,
          qtd_esperada: 5,
          qtd_entregue: 2,
        },
      });

      const expedicaoA = await criarExpedicao({
        idVeiculo: veiculoA.id_veiculo,
        idCondutor: condutorA.id_funcionario,
        dataPrevista: new Date("2026-10-05T00:00:00.000Z"),
        status: "CONCLUIDA",
      });
      const expedicaoB = await criarExpedicao({
        idVeiculo: veiculoB.id_veiculo,
        idCondutor: condutorB.id_funcionario,
        dataPrevista: new Date("2026-10-20T00:00:00.000Z"),
        status: "PLANEJADA",
      });
      const foraDoPeriodo = await criarExpedicao({
        dataPrevista: new Date("2026-09-30T00:00:00.000Z"),
      });
      await vincularNota(expedicaoA.id_expedicao, notaA.id_nota_saida);
      await vincularNota(expedicaoB.id_expedicao, notaB.id_nota_saida);
      await vincularNota(foraDoPeriodo.id_expedicao, notaB.id_nota_saida);

      const resultado = await relatorioDAO.listarExpedicoesRelatorio({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T00:00:00.000Z"),
      });

      expect(resultado.data.map((e) => e.id_expedicao)).toEqual([
        expedicaoB.id_expedicao,
        expedicaoA.id_expedicao,
      ]);
      expect(resultado.data[0]).toMatchObject({
        data_prevista: "2026-10-20",
        status: "Planejada",
        veiculo: "BBB2222",
        condutor: "Bruno Condutor",
        notas: 1,
        destinatarios: "Escola B",
        itens_esperados: 5,
        itens_entregues: 2,
      });
      expect(resultado.data[1]).toMatchObject({
        data_prevista: "2026-10-05",
        status: "Concluída",
        veiculo: "AAA1111",
        condutor: "Ana Condutora",
        notas: 1,
        destinatarios: "Escola A",
        itens_esperados: 10,
        itens_entregues: 8,
      });
      expect(resultado.totais).toEqual({ notas: 2, esperados: 15, entregues: 10 });
    });

    it("filtra por destinatário, condutor, expedição e status, e ignora expedição inativa", async () => {
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const { funcionario: ana } = await criarFuncionario({ nome: "Ana", condutor: true });
      const { funcionario: bruno } = await criarFuncionario({
        nome: "Bruno",
        condutor: true,
      });
      const notaA = await criarNotaSaida({
        idDestinatario: escolaA.destinatario.id_destinatario,
      });
      const notaB = await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });
      const comAna = await criarExpedicao({
        idCondutor: ana.id_funcionario,
        dataPrevista: new Date("2026-10-10T00:00:00.000Z"),
        status: "EM_PERCURSO",
      });
      const comBruno = await criarExpedicao({
        idCondutor: bruno.id_funcionario,
        dataPrevista: new Date("2026-10-12T00:00:00.000Z"),
        status: "PLANEJADA",
      });
      const inativa = await criarExpedicao({
        dataPrevista: new Date("2026-10-15T00:00:00.000Z"),
      });
      await prismaTeste.expedicao.update({
        where: { id_expedicao: inativa.id_expedicao },
        data: { ativo: false },
      });
      await vincularNota(comAna.id_expedicao, notaA.id_nota_saida);
      await vincularNota(comBruno.id_expedicao, notaB.id_nota_saida);
      await vincularNota(inativa.id_expedicao, notaA.id_nota_saida);

      const porDestinatario = await relatorioDAO.listarExpedicoesRelatorio({
        id_destinatario: escolaB.destinatario.id_destinatario,
      });
      expect(porDestinatario.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
      ]);

      const porCondutor = await relatorioDAO.listarExpedicoesRelatorio({
        id_condutor: ana.id_funcionario,
      });
      expect(porCondutor.data.map((e) => e.id_expedicao)).toEqual([
        comAna.id_expedicao,
      ]);

      const porStatus = await relatorioDAO.listarExpedicoesRelatorio({
        status: "PLANEJADA",
      });
      expect(porStatus.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
      ]);

      const porExpedicao = await relatorioDAO.listarExpedicoesRelatorio({
        id_expedicao: comAna.id_expedicao,
      });
      expect(porExpedicao.data.map((e) => e.id_expedicao)).toEqual([
        comAna.id_expedicao,
      ]);

      const todas = await relatorioDAO.listarExpedicoesRelatorio({ status: "todas" });
      expect(todas.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
        comAna.id_expedicao,
      ]);
    });

    it("devolve lista vazia e totais zerados sem expedições", async () => {
      const resultado = await relatorioDAO.listarExpedicoesRelatorio();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ notas: 0, esperados: 0, entregues: 0 });
    });
  });

  describe("listarEntregasRelatorio", () => {
    it("lista notas do período com esperado, entregue e pendente, na ordem decrescente", async () => {
      const escola = await criarDestinatario({ razaoSocial: "Escola Municipal" });
      const produto = await criarProduto({ descricao: "Arroz" });
      const estoque = await criarEstoque(produto.id_produto);

      const notaA = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escola.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-10T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "BAIXA_PARCIAL",
        },
      });
      const notaB = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escola.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-20T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "BAIXA_TOTAL",
        },
      });
      await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escola.destinatario.id_destinatario,
          data_criacao: new Date("2026-09-30T23:59:00.000Z"),
          tipo: "SAIDA",
          status: "ABERTA",
        },
      });
      await prismaTeste.itemNotaSaida.create({
        data: {
          id_nota_saida: notaA.id_nota_saida,
          id_estoque: estoque.id_estoque,
          qtd_esperada: 10,
          qtd_entregue: 6,
        },
      });
      await prismaTeste.itemNotaSaida.create({
        data: {
          id_nota_saida: notaA.id_nota_saida,
          id_estoque: estoque.id_estoque,
          qtd_esperada: 5,
          qtd_entregue: 0,
        },
      });
      await prismaTeste.itemNotaSaida.create({
        data: {
          id_nota_saida: notaB.id_nota_saida,
          id_estoque: estoque.id_estoque,
          qtd_esperada: 4,
          qtd_entregue: 4,
        },
      });

      const resultado = await relatorioDAO.listarEntregasRelatorio({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T23:59:59.999Z"),
      });

      expect(resultado.data.map((n) => n.id_nota_saida)).toEqual([
        notaB.id_nota_saida,
        notaA.id_nota_saida,
      ]);
      expect(resultado.data[1]).toMatchObject({
        codigo: String(notaA.id_nota_saida).padStart(6, "0"),
        destinatario: "Escola Municipal",
        status: "Baixa parcial",
        itens: 2,
        esperado: 15,
        entregue: 6,
        pendente: 9,
        expedicao: "—",
      });
      expect(resultado.data[0]).toMatchObject({
        status: "Baixa total",
        itens: 1,
        esperado: 4,
        entregue: 4,
        pendente: 0,
      });
      expect(resultado.totais).toEqual({ esperado: 19, entregue: 10, pendente: 9 });
    });

    it("usa a expedição do vínculo mais recente", async () => {
      const nota = await criarNotaSaida();
      const antiga = await criarExpedicao();
      const recente = await criarExpedicao();
      await vincularNota(antiga.id_expedicao, nota.id_nota_saida, 1, new Date("2026-10-01"));
      await vincularNota(
        recente.id_expedicao,
        nota.id_nota_saida,
        1,
        new Date("2026-10-05"),
      );

      const resultado = await relatorioDAO.listarEntregasRelatorio();

      expect(resultado.data[0]?.expedicao).toBe(`EXP #${recente.id_expedicao}`);
    });

    it("filtra por destinatário e status, inclusive canceladas", async () => {
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const aberta = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escolaA.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-10T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "ABERTA",
        },
      });
      const cancelada = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escolaA.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-11T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "CANCELADA",
        },
      });
      await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });

      const porDestinatario = await relatorioDAO.listarEntregasRelatorio({
        id_destinatario: escolaA.destinatario.id_destinatario,
      });
      expect(porDestinatario.data.map((n) => n.id_nota_saida)).toEqual([
        cancelada.id_nota_saida,
        aberta.id_nota_saida,
      ]);

      const porStatus = await relatorioDAO.listarEntregasRelatorio({
        status: "CANCELADA",
      });
      expect(porStatus.data.map((n) => n.id_nota_saida)).toEqual([
        cancelada.id_nota_saida,
      ]);

      const todos = await relatorioDAO.listarEntregasRelatorio({ status: "todos" });
      expect(todos.data).toHaveLength(3);
    });

    it("devolve lista vazia e totais zerados sem notas", async () => {
      const resultado = await relatorioDAO.listarEntregasRelatorio();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ esperado: 0, entregue: 0, pendente: 0 });
    });
  });

  describe("listas para os selects", () => {
    it("lista condutores ativos por nome e mantém o selecionado inativo", async () => {
      const bruno = await criarFuncionario({ nome: "Bruno", condutor: true });
      const ana = await criarFuncionario({ nome: "Ana", condutor: true });
      await criarFuncionario({ nome: "Carlos", condutor: false });
      const inativo = await criarFuncionario({ nome: "Diego", condutor: true });
      await prismaTeste.funcionario.update({
        where: { id_funcionario: inativo.funcionario.id_funcionario },
        data: { ativo: false },
      });

      const condutores = await relatorioDAO.listarCondutoresParaFiltro();
      expect(condutores.map((c) => c.nome)).toEqual(["Ana", "Bruno"]);
      expect(condutores[0]?.id_funcionario).toBe(ana.funcionario.id_funcionario);
      expect(condutores[1]?.id_funcionario).toBe(bruno.funcionario.id_funcionario);

      const comInativo = await relatorioDAO.listarCondutoresParaFiltro(
        inativo.funcionario.id_funcionario,
      );
      expect(comInativo.map((c) => c.nome)).toEqual(["Ana", "Bruno", "Diego"]);
    });

    it("lista expedições do período e mantém a selecionada fora dele", async () => {
      const dentro = await criarExpedicao({
        dataPrevista: new Date("2026-10-10T00:00:00.000Z"),
      });
      const fora = await criarExpedicao({
        dataPrevista: new Date("2026-11-10T00:00:00.000Z"),
      });

      const expedicoes = await relatorioDAO.listarExpedicoesParaFiltro({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T00:00:00.000Z"),
      });
      expect(expedicoes.map((e) => e.id_expedicao)).toEqual([dentro.id_expedicao]);
      expect(expedicoes[0]).toMatchObject({
        codigo: String(dentro.id_expedicao).padStart(6, "0"),
        data_prevista: "2026-10-10",
      });

      const comSelecionada = await relatorioDAO.listarExpedicoesParaFiltro({
        de: new Date("2026-10-01T00:00:00.000Z"),
        ate: new Date("2026-10-31T00:00:00.000Z"),
        incluirId: fora.id_expedicao,
      });
      expect(comSelecionada.map((e) => e.id_expedicao)).toEqual([
        fora.id_expedicao,
        dentro.id_expedicao,
      ]);

      const todas = await relatorioDAO.listarExpedicoesParaFiltro();
      expect(todas.map((e) => e.id_expedicao)).toEqual([
        fora.id_expedicao,
        dentro.id_expedicao,
      ]);
    });
  });
});
