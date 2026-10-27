import { describe, expect, it } from "vitest";
import { dashboardDAO } from "@/dao/dashboard";
import {
  criarDestinatario,
  criarEstoque,
  criarExpedicao,
  criarMovimentacao,
  criarNotaEntrada,
  criarNotaSaida,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";

const AGORA = new Date("2026-10-25T15:00:00.000Z"); // 12:00 em São Paulo

function validadeEmDias(dias: number) {
  return new Date(Date.UTC(2026, 9, 25) + dias * 24 * 60 * 60 * 1000);
}

describe("dashboardDAO", () => {
  describe("resumoEstoque", () => {
    it("soma quantidades ativas e conta produtos com saldo positivo", async () => {
      const a = await criarProduto();
      const b = await criarProduto();
      const c = await criarProduto();
      await criarEstoque(a.id_produto, { quantidadeAtual: 10 });
      await criarEstoque(a.id_produto, { quantidadeAtual: 5 });
      await criarEstoque(b.id_produto, { quantidadeAtual: 0 });
      await criarEstoque(c.id_produto, { quantidadeAtual: -2 });

      await expect(dashboardDAO.resumoEstoque()).resolves.toEqual({
        itens: 13,
        produtosComSaldo: 1,
      });
    });

    it("devolve zeros quando não há estoque", async () => {
      await expect(dashboardDAO.resumoEstoque()).resolves.toEqual({
        itens: 0,
        produtosComSaldo: 0,
      });
    });
  });

  it("conta só saídas pendentes/parciais e expedições em percurso ativas", async () => {
    await criarNotaSaida({ status: "PENDENTE" });
    await criarNotaSaida({ status: "BAIXA_PARCIAL" });
    await criarNotaSaida({ status: "ABERTA" });
    await criarNotaSaida({ status: "PENDENTE", ativo: false });
    await criarExpedicao({ status: "EM_PERCURSO" });
    await criarExpedicao({ status: "CONCLUIDA" });
    await criarExpedicao({ status: "EM_PERCURSO", ativo: false });

    await expect(dashboardDAO.contarSaidasPendentes()).resolves.toBe(2);
    await expect(dashboardDAO.contarExpedicoesAtivas()).resolves.toBe(1);
  });

  it("conta perecíveis vencendo entre hoje e 30 dias", async () => {
    await criarProduto({ perecivel: true, dataValidade: validadeEmDias(0) });
    await criarProduto({ perecivel: true, dataValidade: validadeEmDias(30) });
    await criarProduto({ perecivel: true, dataValidade: validadeEmDias(31) });
    await criarProduto({ perecivel: true, dataValidade: validadeEmDias(-1) });
    await criarProduto({ perecivel: false, dataValidade: validadeEmDias(10) });

    await expect(dashboardDAO.contarVencendoEm30Dias(AGORA)).resolves.toBe(2);
  });

  describe("movimentacoesPorMes", () => {
    it("separa entradas e saídas por nota e ignora ajustes", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
      const entrada = await criarNotaEntrada();
      const saida = await criarNotaSaida({ status: "BAIXA_TOTAL" });

      await criarMovimentacao(estoque.id_produto, usuario.id_usuario, 10, {
        dataHora: new Date("2026-09-10T15:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_produto, usuario.id_usuario, 2, {
        dataHora: new Date("2026-10-05T15:00:00.000Z"),
        idNotaEntrada: entrada.id_nota_entrada,
      });
      await criarMovimentacao(estoque.id_produto, usuario.id_usuario, -4, {
        dataHora: new Date("2026-10-06T15:00:00.000Z"),
        idNotaSaida: saida.id_nota_saida,
      });
      await criarMovimentacao(estoque.id_produto, usuario.id_usuario, 99, {
        dataHora: new Date("2026-10-07T15:00:00.000Z"),
      });

      const serie = await dashboardDAO.movimentacoesPorMes(AGORA);

      expect(serie.labels).toEqual([
        "mai/26",
        "jun/26",
        "jul/26",
        "ago/26",
        "set/26",
        "out/26",
      ]);
      expect(serie.entradas).toEqual([0, 0, 0, 0, 10, 2]);
      expect(serie.saidas).toEqual([0, 0, 0, 0, 0, 4]);
    });

    it("devolve a série zerada quando não há movimentações", async () => {
      const serie = await dashboardDAO.movimentacoesPorMes(AGORA);

      expect(serie.labels).toHaveLength(6);
      expect(serie.entradas.every((valor) => valor === 0)).toBe(true);
      expect(serie.saidas.every((valor) => valor === 0)).toBe(true);
    });
  });

  describe("topProdutos", () => {
    it("traz os 5 maiores saldos, ignorando zero", async () => {
      for (let quantidade = 1; quantidade <= 6; quantidade += 1) {
        const produto = await criarProduto({ descricao: `Produto ${quantidade}` });
        await criarEstoque(produto.id_produto, { quantidadeAtual: quantidade * 10 });
      }
      const zerado = await criarProduto({ descricao: "Zerado" });
      await criarEstoque(zerado.id_produto, { quantidadeAtual: 0 });

      const top = await dashboardDAO.topProdutos();

      expect(top).toHaveLength(5);
      expect(top.map((item) => item.quantidade)).toEqual([60, 50, 40, 30, 20]);
      expect(top[0]).toMatchObject({ descricao: "Produto 6" });
      expect(top[0]).not.toHaveProperty("unidade");
    });

    it("devolve vazio sem produtos com saldo", async () => {
      await expect(dashboardDAO.topProdutos()).resolves.toEqual([]);
    });
  });

  describe("notasPorStatus", () => {
    it("agrupa com rótulo legível e na ordem do domínio", async () => {
      await criarNotaSaida({ status: "ABERTA" });
      await criarNotaSaida({ status: "ABERTA" });
      await criarNotaSaida({ status: "PENDENTE" });
      await criarNotaSaida({ status: "CANCELADA" });
      await criarNotaSaida({ status: "PENDENTE", ativo: false });

      const status = await dashboardDAO.notasPorStatus();

      expect(status).toEqual([
        { status: "ABERTA", label: "Aberta", total: 2 },
        { status: "PENDENTE", label: "Pendente", total: 1 },
        { status: "CANCELADA", label: "Cancelada", total: 1 },
      ]);
    });

    it("devolve vazio sem notas", async () => {
      await expect(dashboardDAO.notasPorStatus()).resolves.toEqual([]);
    });
  });

  describe("pendencias", () => {
    it("lista notas PENDENTE/BAIXA_PARCIAL com destinatário real", async () => {
      const { destinatario } = await criarDestinatario({
        razaoSocial: "RAZAO ESCOLA",
        nomeFantasia: "ESCOLA FANTASIA",
      });
      await criarNotaSaida({
        idDestinatario: destinatario.id_destinatario,
        status: "PENDENTE",
        dataCriacao: new Date("2026-10-21T12:00:00.000Z"),
      });
      await criarNotaSaida({
        idDestinatario: destinatario.id_destinatario,
        status: "BAIXA_PARCIAL",
        dataCriacao: new Date("2026-10-20T12:00:00.000Z"),
      });
      await criarNotaSaida({ status: "ABERTA" });

      const pendencias = await dashboardDAO.pendencias();

      expect(pendencias).toHaveLength(2);
      expect(pendencias[0]).toMatchObject({
        destinatario: "ESCOLA FANTASIA",
        label: "Pendente",
      });
      expect(pendencias[1]?.label).toBe("Baixa parcial");
    });

    it("devolve vazio quando não há pendência", async () => {
      await criarNotaSaida({ status: "BAIXA_TOTAL" });
      await expect(dashboardDAO.pendencias()).resolves.toEqual([]);
    });
  });

  describe("obterResumo", () => {
    it("zera as seções sem permissão", async () => {
      const produto = await criarProduto({
        perecivel: true,
        dataValidade: validadeEmDias(10),
      });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 5 });
      await criarNotaSaida({ status: "PENDENTE" });
      await criarExpedicao({ status: "EM_PERCURSO" });

      const semPermissao = await dashboardDAO.obterResumo(
        { estoque: false, notas: false, expedicoes: false },
        AGORA,
      );

      expect(semPermissao.estoque).toEqual({ itens: 0, produtosComSaldo: 0 });
      expect(semPermissao.saidasPendentes).toBe(0);
      expect(semPermissao.expedicoesAtivas).toBe(0);
      expect(semPermissao.vencendoEm30Dias).toBe(0);
      expect(semPermissao.movimentacoes.entradas.every((v) => v === 0)).toBe(true);
      expect(semPermissao.topProdutos).toEqual([]);
      expect(semPermissao.statusNotas).toEqual([]);
      expect(semPermissao.pendencias).toEqual([]);
    });

    it("mantém a seção de estoque quando só ela é permitida", async () => {
      const produto = await criarProduto({
        perecivel: true,
        dataValidade: validadeEmDias(10),
      });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 5 });
      await criarNotaSaida({ status: "PENDENTE" });
      await criarExpedicao({ status: "EM_PERCURSO" });

      const resumo = await dashboardDAO.obterResumo(
        { estoque: true, notas: false, expedicoes: false },
        AGORA,
      );

      expect(resumo.estoque).toEqual({ itens: 5, produtosComSaldo: 1 });
      expect(resumo.vencendoEm30Dias).toBe(1);
      expect(resumo.topProdutos).toHaveLength(1);
      expect(resumo.saidasPendentes).toBe(0);
      expect(resumo.expedicoesAtivas).toBe(0);
      expect(resumo.pendencias).toEqual([]);
    });
  });
});
