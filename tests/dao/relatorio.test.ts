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
        id_destinatarios: [escolaA.destinatario.id_destinatario],
      });
      expect(porDestinatario.data).toHaveLength(1);
      expect(porDestinatario.data[0]).toMatchObject({
        tipo: "Saída",
        quantidade: -4,
        destinatario_fornecedor: "Escola A",
      });
      expect(porDestinatario.totais).toEqual({ entradas: 0, saidas: 4 });

      const porFornecedor = await relatorioDAO.listarMovimentacoes({
        id_fornecedores: [fornecedorA.fornecedor.id_fornecedor],
      });
      expect(porFornecedor.data).toHaveLength(1);
      expect(porFornecedor.data[0]).toMatchObject({
        tipo: "Entrada",
        quantidade: 10,
        destinatario_fornecedor: "Fornecedor A",
      });
      expect(porFornecedor.totais).toEqual({ entradas: 10, saidas: 0 });

      const semMovimentacao = await relatorioDAO.listarMovimentacoes({
        id_fornecedores: [fornecedorB.fornecedor.id_fornecedor],
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

      const comInativa = await relatorioDAO.listarDestinatariosParaFiltro([
        escolaInativa.destinatario.id_destinatario,
      ]);
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
        id_produtos: [feijao.id_produto],
      });

      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0]).toMatchObject({
        id_produto: feijao.id_produto,
        produto: "Feijão",
        quantidade: 7,
      });
      expect(resultado.totais).toEqual({ entradas: 7, saidas: 0 });
    });

    it("filtra por vários produtos e combina com destinatários", async () => {
      const { usuario } = await criarUsuario();
      const arroz = await criarProduto({ descricao: "Arroz" });
      const feijao = await criarProduto({ descricao: "Feijão" });
      const acucar = await criarProduto({ descricao: "Açúcar" });
      const estoqueArroz = await criarEstoque(arroz.id_produto);
      const estoqueFeijao = await criarEstoque(feijao.id_produto);
      const estoqueAcucar = await criarEstoque(acucar.id_produto);
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const saidaA = await criarNotaSaida({
        idDestinatario: escolaA.destinatario.id_destinatario,
      });
      const saidaB = await criarNotaSaida({
        idDestinatario: escolaB.destinatario.id_destinatario,
      });

      await criarMovimentacao(estoqueArroz.id_estoque, usuario.id_usuario, -2, {
        dataHora: new Date("2026-10-02T12:00:00.000Z"),
        idNotaSaida: saidaA.id_nota_saida,
      });
      await criarMovimentacao(estoqueFeijao.id_estoque, usuario.id_usuario, -3, {
        dataHora: new Date("2026-10-03T12:00:00.000Z"),
        idNotaSaida: saidaB.id_nota_saida,
      });
      await criarMovimentacao(estoqueAcucar.id_estoque, usuario.id_usuario, -5, {
        dataHora: new Date("2026-10-04T12:00:00.000Z"),
        idNotaSaida: saidaA.id_nota_saida,
      });

      const doisProdutos = await relatorioDAO.listarMovimentacoes({
        id_produtos: [arroz.id_produto, feijao.id_produto],
      });
      expect(doisProdutos.data.map((m) => m.produto)).toEqual(["Arroz", "Feijão"]);

      const combinado = await relatorioDAO.listarMovimentacoes({
        id_produtos: [arroz.id_produto, acucar.id_produto],
        id_destinatarios: [escolaA.destinatario.id_destinatario],
      });
      expect(combinado.data.map((m) => m.produto)).toEqual(["Arroz", "Açúcar"]);

      const doisDestinatarios = await relatorioDAO.listarMovimentacoes({
        id_destinatarios: [
          escolaA.destinatario.id_destinatario,
          escolaB.destinatario.id_destinatario,
        ],
      });
      expect(doisDestinatarios.data).toHaveLength(3);
    });

    it("filtra por tipo entrada e saída, deixando o ajuste só sem filtro", async () => {
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

      const entradas = await relatorioDAO.listarMovimentacoes({ tipos: ["entrada"] });
      expect(entradas.data.map((m) => m.tipo)).toEqual(["Entrada"]);
      expect(entradas.totais).toEqual({ entradas: 10, saidas: 0 });

      const saidas = await relatorioDAO.listarMovimentacoes({ tipos: ["saida"] });
      expect(saidas.data.map((m) => m.tipo)).toEqual(["Saída"]);
      expect(saidas.totais).toEqual({ entradas: 0, saidas: 3 });

      const todos = await relatorioDAO.listarMovimentacoes({ tipos: [] });
      expect(todos.data.map((m) => m.tipo)).toEqual(["Entrada", "Saída", "Ajuste"]);
      expect(todos.totais).toEqual({ entradas: 11, saidas: 3 });

      // Entrada + saída: união das duas; o ajuste (sem nota) fica fora.
      const entradasESaidas = await relatorioDAO.listarMovimentacoes({
        tipos: ["entrada", "saida"],
      });
      expect(entradasESaidas.data.map((m) => m.tipo)).toEqual(["Entrada", "Saída"]);
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
        id_destinatarios: [escolaB.destinatario.id_destinatario],
      });
      expect(porDestinatario.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
      ]);

      const porCondutor = await relatorioDAO.listarExpedicoesRelatorio({
        id_condutores: [ana.id_funcionario],
      });
      expect(porCondutor.data.map((e) => e.id_expedicao)).toEqual([
        comAna.id_expedicao,
      ]);

      const porStatus = await relatorioDAO.listarExpedicoesRelatorio({
        status: ["PLANEJADA"],
      });
      expect(porStatus.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
      ]);

      const porExpedicao = await relatorioDAO.listarExpedicoesRelatorio({
        id_expedicoes: [comAna.id_expedicao],
      });
      expect(porExpedicao.data.map((e) => e.id_expedicao)).toEqual([
        comAna.id_expedicao,
      ]);

      const todas = await relatorioDAO.listarExpedicoesRelatorio({ status: [] });
      expect(todas.data.map((e) => e.id_expedicao)).toEqual([
        comBruno.id_expedicao,
        comAna.id_expedicao,
      ]);
    });

    it("combina múltiplos destinatários, condutores e status", async () => {
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const escolaC = await criarDestinatario({ razaoSocial: "Escola C" });
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
      const notaC = await criarNotaSaida({
        idDestinatario: escolaC.destinatario.id_destinatario,
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
      const terceira = await criarExpedicao({
        idCondutor: bruno.id_funcionario,
        dataPrevista: new Date("2026-10-14T00:00:00.000Z"),
        status: "CONCLUIDA",
      });
      await vincularNota(comAna.id_expedicao, notaA.id_nota_saida);
      await vincularNota(comBruno.id_expedicao, notaB.id_nota_saida);
      await vincularNota(terceira.id_expedicao, notaC.id_nota_saida);

      const doisDestinatarios = await relatorioDAO.listarExpedicoesRelatorio({
        id_destinatarios: [
          escolaA.destinatario.id_destinatario,
          escolaC.destinatario.id_destinatario,
        ],
      });
      expect(doisDestinatarios.data.map((e) => e.id_expedicao)).toEqual([
        terceira.id_expedicao,
        comAna.id_expedicao,
      ]);

      const doisStatus = await relatorioDAO.listarExpedicoesRelatorio({
        status: ["PLANEJADA", "CONCLUIDA"],
      });
      expect(doisStatus.data.map((e) => e.id_expedicao)).toEqual([
        terceira.id_expedicao,
        comBruno.id_expedicao,
      ]);

      const combinado = await relatorioDAO.listarExpedicoesRelatorio({
        id_condutores: [bruno.id_funcionario],
        status: ["CONCLUIDA"],
      });
      expect(combinado.data.map((e) => e.id_expedicao)).toEqual([
        terceira.id_expedicao,
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
        id_destinatarios: [escolaA.destinatario.id_destinatario],
      });
      expect(porDestinatario.data.map((n) => n.id_nota_saida)).toEqual([
        cancelada.id_nota_saida,
        aberta.id_nota_saida,
      ]);

      const porStatus = await relatorioDAO.listarEntregasRelatorio({
        status: ["CANCELADA"],
      });
      expect(porStatus.data.map((n) => n.id_nota_saida)).toEqual([
        cancelada.id_nota_saida,
      ]);

      const todos = await relatorioDAO.listarEntregasRelatorio({ status: [] });
      expect(todos.data).toHaveLength(3);
    });

    it("combina múltiplos destinatários e status", async () => {
      const escolaA = await criarDestinatario({ razaoSocial: "Escola A" });
      const escolaB = await criarDestinatario({ razaoSocial: "Escola B" });
      const escolaC = await criarDestinatario({ razaoSocial: "Escola C" });
      const notaA = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escolaA.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-10T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "ABERTA",
        },
      });
      const notaB = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escolaB.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-11T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "BAIXA_PARCIAL",
        },
      });
      const notaC = await prismaTeste.notaSaida.create({
        data: {
          id_destinatario: escolaC.destinatario.id_destinatario,
          data_criacao: new Date("2026-10-12T12:00:00.000Z"),
          tipo: "SAIDA",
          status: "BAIXA_TOTAL",
        },
      });

      const doisDestinatarios = await relatorioDAO.listarEntregasRelatorio({
        id_destinatarios: [
          escolaA.destinatario.id_destinatario,
          escolaC.destinatario.id_destinatario,
        ],
      });
      expect(doisDestinatarios.data.map((n) => n.id_nota_saida)).toEqual([
        notaC.id_nota_saida,
        notaA.id_nota_saida,
      ]);

      const doisStatus = await relatorioDAO.listarEntregasRelatorio({
        status: ["ABERTA", "BAIXA_PARCIAL"],
      });
      expect(doisStatus.data.map((n) => n.id_nota_saida)).toEqual([
        notaB.id_nota_saida,
        notaA.id_nota_saida,
      ]);

      const combinado = await relatorioDAO.listarEntregasRelatorio({
        id_destinatarios: [escolaB.destinatario.id_destinatario],
        status: ["BAIXA_PARCIAL"],
      });
      expect(combinado.data.map((n) => n.id_nota_saida)).toEqual([
        notaB.id_nota_saida,
      ]);
    });

    it("devolve lista vazia e totais zerados sem notas", async () => {
      const resultado = await relatorioDAO.listarEntregasRelatorio();
      expect(resultado.data).toEqual([]);
      expect(resultado.totais).toEqual({ esperado: 0, entregue: 0, pendente: 0 });
    });
  });

  describe("listarProdutosVencimento", () => {
    const hoje = new Date("2026-10-24T00:00:00.000Z");

    it("lista só perecíveis com validade, ordena por validade e calcula dias e situação", async () => {
      const caixa = await criarConversao("CX");
      const vencido = await criarProduto({
        descricao: "Leite",
        perecivel: true,
        dataValidade: new Date("2026-10-20T00:00:00.000Z"),
        idConversaoPadrao: caixa.id_conversao,
      });
      const venceHoje = await criarProduto({
        descricao: "Iogurte",
        perecivel: true,
        dataValidade: new Date("2026-10-24T00:00:00.000Z"),
      });
      const aVencer = await criarProduto({
        descricao: "Queijo",
        perecivel: true,
        dataValidade: new Date("2026-11-10T00:00:00.000Z"),
      });
      await criarProduto({
        descricao: "Arroz",
        perecivel: false,
        dataValidade: new Date("2026-10-25T00:00:00.000Z"),
      });
      await criarProduto({ descricao: "Sem validade", perecivel: true });

      await criarEstoque(vencido.id_produto, { quantidadeAtual: 3 });
      await criarEstoque(vencido.id_produto, { quantidadeAtual: 2.5 });
      await criarEstoque(vencido.id_produto, { quantidadeAtual: 99, ativo: false });
      await criarEstoque(venceHoje.id_produto, { quantidadeAtual: 1 });
      await criarEstoque(aVencer.id_produto, { quantidadeAtual: 4 });

      const resultado = await relatorioDAO.listarProdutosVencimento({
        dias: "todos",
        hoje,
      });

      expect(resultado.data.map((p) => p.descricao)).toEqual([
        "Leite",
        "Iogurte",
        "Queijo",
      ]);
      expect(resultado.data[0]).toMatchObject({
        id_produto: vencido.id_produto,
        codigo: String(vencido.id_produto).padStart(6, "0"),
        unidade: "CX",
        quantidade: 5.5,
        validade: "2026-10-20",
        dias_restantes: -4,
        situacao: "Vencido (4)",
      });
      expect(resultado.data[1]).toMatchObject({
        dias_restantes: 0,
        situacao: "Vence hoje",
      });
      expect(resultado.data[2]).toMatchObject({
        dias_restantes: 17,
        situacao: "Vence em 17",
      });
      expect(resultado.totais).toEqual({ itens: 3, vencidos: 1 });
    });

    it("limita os dias para vencer e marca OK o produto fora do primeiro alerta", async () => {
      await criarProduto({
        descricao: "Dois dias",
        perecivel: true,
        dataValidade: new Date("2026-10-26T00:00:00.000Z"),
      });
      await criarProduto({
        descricao: "Trinta e oito dias",
        perecivel: true,
        dataValidade: new Date("2026-12-01T00:00:00.000Z"),
      });
      await criarProduto({
        descricao: "Cem dias",
        perecivel: true,
        dataValidade: new Date("2027-02-01T00:00:00.000Z"),
      });
      await criarProduto({
        descricao: "Duzentos e vinte dias",
        perecivel: true,
        dataValidade: new Date("2027-06-01T00:00:00.000Z"),
      });

      const trinta = await relatorioDAO.listarProdutosVencimento({ dias: 30, hoje });
      expect(trinta.data.map((p) => p.descricao)).toEqual(["Dois dias"]);

      const sessenta = await relatorioDAO.listarProdutosVencimento({ dias: 60, hoje });
      expect(sessenta.data.map((p) => p.descricao)).toEqual([
        "Dois dias",
        "Trinta e oito dias",
      ]);

      const centoEVinte = await relatorioDAO.listarProdutosVencimento({
        dias: 120,
        hoje,
      });
      expect(centoEVinte.data.map((p) => p.descricao)).toEqual([
        "Dois dias",
        "Trinta e oito dias",
        "Cem dias",
      ]);
      expect(centoEVinte.data[2]?.situacao).toBe("OK");
      expect(centoEVinte.totais).toEqual({ itens: 3, vencidos: 0 });

      const todos = await relatorioDAO.listarProdutosVencimento({
        dias: "todos",
        hoje,
      });
      expect(todos.data).toHaveLength(4);
    });
  });

  describe("listarFuncionariosRelatorio", () => {
    it("lista por nome com contato principal, condutor e situação, filtrando por situação", async () => {
      const ana = await criarFuncionario({
        nome: "Ana",
        cpf: "11111111111",
        cargo: "Conferente",
        condutor: true,
      });
      const bruno = await criarFuncionario({
        nome: "Bruno",
        cpf: "22222222222",
        ativo: false,
      });

      await prismaTeste.funcionarioEmail.create({
        data: {
          id_funcionario: ana.funcionario.id_funcionario,
          endereco: "ana@nexus.test",
          principal: true,
        },
      });
      await prismaTeste.funcionarioEmail.create({
        data: {
          id_funcionario: ana.funcionario.id_funcionario,
          endereco: "ana.secundario@nexus.test",
          principal: false,
        },
      });
      await prismaTeste.funcionarioTelefone.create({
        data: {
          id_funcionario: ana.funcionario.id_funcionario,
          numero: "21999990001",
          tipo: "CELULAR",
          principal: true,
        },
      });
      await prismaTeste.funcionarioTelefone.create({
        data: {
          id_funcionario: ana.funcionario.id_funcionario,
          numero: "21999990002",
          tipo: "FIXO",
          principal: false,
        },
      });

      const todos = await relatorioDAO.listarFuncionariosRelatorio();
      expect(todos.data.map((f) => f.nome)).toEqual(["Ana", "Bruno"]);
      expect(todos.data[0]).toMatchObject({
        id_funcionario: ana.funcionario.id_funcionario,
        codigo: String(ana.funcionario.id_funcionario).padStart(6, "0"),
        cpf: "11111111111",
        cargo: "Conferente",
        condutor: true,
        situacao: "Ativo",
        email: "ana@nexus.test",
        telefone: "21999990001",
      });
      expect(todos.data[1]).toMatchObject({
        id_funcionario: bruno.funcionario.id_funcionario,
        situacao: "Inativo",
        email: null,
        telefone: null,
      });

      const ativos = await relatorioDAO.listarFuncionariosRelatorio({
        situacoes: ["ativos"],
      });
      expect(ativos.data.map((f) => f.nome)).toEqual(["Ana"]);

      const inativos = await relatorioDAO.listarFuncionariosRelatorio({
        situacoes: ["inativos"],
      });
      expect(inativos.data.map((f) => f.nome)).toEqual(["Bruno"]);

      const ambos = await relatorioDAO.listarFuncionariosRelatorio({
        situacoes: ["ativos", "inativos"],
      });
      expect(ambos.data.map((f) => f.nome)).toEqual(["Ana", "Bruno"]);
    });
  });

  describe("listarDestinatariosRelatorio", () => {
    it("lista com razão social, CNPJ, tipo, endereço e contato, filtrando situação e tipo", async () => {
      const escola = await criarDestinatario({
        razaoSocial: "Escola A",
        tipo: "ESCOLA",
      });
      const creche = await criarDestinatario({
        razaoSocial: "Creche B",
        tipo: "CRECHE",
        ativo: false,
      });

      await prismaTeste.pessoaJuridica.update({
        where: { id_pessoa_juridica: escola.pessoaJuridica.id_pessoa_juridica },
        data: { cnpj: "11222333000181" },
      });
      await prismaTeste.endereco.update({
        where: { id_endereco: escola.endereco.id_endereco },
        data: { numero: "10", bairro: "Centro" },
      });
      await prismaTeste.destinatarioEmail.create({
        data: {
          id_destinatario: escola.destinatario.id_destinatario,
          endereco: "escola@nexus.test",
          principal: true,
        },
      });
      await prismaTeste.destinatarioTelefone.create({
        data: {
          id_destinatario: escola.destinatario.id_destinatario,
          numero: "2133334444",
          tipo: "COMERCIAL",
          principal: true,
        },
      });

      const todos = await relatorioDAO.listarDestinatariosRelatorio();
      expect(todos.data.map((d) => d.razao_social)).toEqual(["Creche B", "Escola A"]);
      expect(todos.data[0]).toMatchObject({
        id_destinatario: creche.destinatario.id_destinatario,
        tipo: "Creche",
        situacao: "Inativo",
        cnpj: null,
        email: null,
        telefone: null,
      });
      expect(todos.data[1]).toMatchObject({
        codigo: String(escola.destinatario.id_destinatario).padStart(6, "0"),
        cnpj: "11222333000181",
        tipo: "Escola",
        situacao: "Ativo",
        endereco: `${escola.endereco.logradouro}, 10 - Centro - Rio de Janeiro`,
        email: "escola@nexus.test",
        telefone: "2133334444",
      });

      const ativos = await relatorioDAO.listarDestinatariosRelatorio({
        situacoes: ["ativos"],
      });
      expect(ativos.data.map((d) => d.razao_social)).toEqual(["Escola A"]);

      const creches = await relatorioDAO.listarDestinatariosRelatorio({
        tipos: ["CRECHE"],
      });
      expect(creches.data.map((d) => d.razao_social)).toEqual(["Creche B"]);

      const combinado = await relatorioDAO.listarDestinatariosRelatorio({
        situacoes: ["ativos"],
        tipos: ["CRECHE"],
      });
      expect(combinado.data).toEqual([]);
    });
  });

  describe("listarFornecedoresRelatorio", () => {
    it("lista com CNPJ, situação, endereço e contato, filtrando por situação", async () => {
      const comEndereco = await criarFornecedor({
        razaoSocial: "Fornecedor A",
        comEndereco: true,
      });
      const semEndereco = await criarFornecedor({
        razaoSocial: "Fornecedor B",
        ativo: false,
      });

      await prismaTeste.pessoaJuridica.update({
        where: { id_pessoa_juridica: comEndereco.pessoaJuridica.id_pessoa_juridica },
        data: { cnpj: "22333444000192" },
      });
      await prismaTeste.endereco.update({
        where: { id_endereco: comEndereco.endereco!.id_endereco },
        data: { numero: "20", bairro: "Centro" },
      });
      await prismaTeste.fornecedorEmail.create({
        data: {
          id_fornecedor: comEndereco.fornecedor.id_fornecedor,
          endereco: "fornecedor@nexus.test",
          principal: true,
        },
      });
      await prismaTeste.fornecedorTelefone.create({
        data: {
          id_fornecedor: comEndereco.fornecedor.id_fornecedor,
          numero: "2144445555",
          tipo: "COMERCIAL",
          principal: true,
        },
      });

      const todos = await relatorioDAO.listarFornecedoresRelatorio();
      expect(todos.data.map((f) => f.razao_social)).toEqual([
        "Fornecedor A",
        "Fornecedor B",
      ]);
      expect(todos.data[0]).toMatchObject({
        id_fornecedor: comEndereco.fornecedor.id_fornecedor,
        codigo: String(comEndereco.fornecedor.id_fornecedor).padStart(6, "0"),
        cnpj: "22333444000192",
        situacao: "Ativo",
        endereco: `${comEndereco.endereco!.logradouro}, 20 - Centro - Rio de Janeiro`,
        email: "fornecedor@nexus.test",
        telefone: "2144445555",
      });
      expect(todos.data[1]).toMatchObject({
        id_fornecedor: semEndereco.fornecedor.id_fornecedor,
        situacao: "Inativo",
        endereco: "—",
      });

      const ativos = await relatorioDAO.listarFornecedoresRelatorio({
        situacoes: ["ativos"],
      });
      expect(ativos.data.map((f) => f.razao_social)).toEqual(["Fornecedor A"]);

      const inativos = await relatorioDAO.listarFornecedoresRelatorio({
        situacoes: ["inativos"],
      });
      expect(inativos.data.map((f) => f.razao_social)).toEqual(["Fornecedor B"]);
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

      const comInativo = await relatorioDAO.listarCondutoresParaFiltro([
        inativo.funcionario.id_funcionario,
      ]);
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
        incluirIds: [fora.id_expedicao],
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
