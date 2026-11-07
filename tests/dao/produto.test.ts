import { describe, expect, it } from "vitest";
import { produtoDAO } from "@/dao/produto";
import { EntidadeComVinculosError } from "@/dao/_errors";
import { produtoParaLinha } from "@/lib/produto-linha";
import {
  criarConversao,
  criarEstoque,
  criarNotaEntrada,
  criarProduto,
  criarTipoCodigo,
  criarUsuario,
  garantirUnidadePadrao,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("produtoDAO", () => {
  describe("list", () => {
    it("pagina, busca por descrição e ignora inativos", async () => {
      await criarProduto({ descricao: "Arroz" });
      await criarProduto({ descricao: "Feijão" });
      await criarProduto({ descricao: "Arroz integral", ativo: false });

      const todos = await produtoDAO.list({ page: 1, limit: 1 });
      expect(todos.total).toBe(2);
      expect(todos.totalPages).toBe(2);
      expect(todos.data[0]?.descricao).toBe("Arroz");

      const busca = await produtoDAO.list({ search: "Feij" });
      expect(busca.total).toBe(1);
      expect(busca.data[0]?.descricao).toBe("Feijão");
    });

    it("inclui conversão padrão e o saldo do produto", async () => {
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });

      const resultado = await produtoDAO.list({});

      expect(resultado.data[0]?.saldo).toBe(10);
      expect(resultado.data[0]).not.toHaveProperty("conversaoPadrao");
    });

    it("exclui os ids informados e mantém o total coerente", async () => {
      const manter = await criarProduto({ descricao: "Manter" });
      const excluir = await criarProduto({ descricao: "Excluir" });

      const resultado = await produtoDAO.list({ page: 1, limit: 10 }, [excluir.id_produto]);

      expect(resultado.total).toBe(1);
      expect(resultado.totalPages).toBe(1);
      expect(resultado.data.map((p) => p.id_produto)).toEqual([manter.id_produto]);
    });

    it("filtra a situação: só inativos com ativo:false e ambos com ativo:null", async () => {
      const ativo = await criarProduto({ descricao: "Ativo lista" });
      const inativo = await criarProduto({ descricao: "Inativo lista", ativo: false });

      const soInativos = await produtoDAO.list({ ativo: false });
      expect(soInativos.data.map((p) => p.id_produto)).toEqual([inativo.id_produto]);
      expect(soInativos.total).toBe(1);

      const todos = await produtoDAO.list({ ativo: null });
      expect(todos.total).toBe(2);
      expect(todos.data.map((p) => p.id_produto)).toEqual([
        ativo.id_produto,
        inativo.id_produto,
      ]);
    });

    it("filtra por perecível, composto e tipo de código", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const perecivel = await criarProduto({ descricao: "Perecível", perecivel: true });
      const composto = await criarProduto({ descricao: "Composto", composto: true });
      const comTipo = await criarProduto({ descricao: "Com tipo" });
      await prismaTeste.produtoCodigo.create({
        data: {
          id_produto: comTipo.id_produto,
          id_tipo_codigo: tipo.id_tipo_codigo,
          codigo: "TIPO-1",
        },
      });

      const soPerecivel = await produtoDAO.list({ perecivel: true });
      expect(soPerecivel.data.map((p) => p.id_produto)).toEqual([perecivel.id_produto]);

      const soComposto = await produtoDAO.list({ composto: true });
      expect(soComposto.data.map((p) => p.id_produto)).toEqual([composto.id_produto]);

      const soTipo = await produtoDAO.list({ id_tipo_codigo: [tipo.id_tipo_codigo] });
      expect(soTipo.data.map((p) => p.id_produto)).toEqual([comTipo.id_produto]);

      const semFiltro = await produtoDAO.list({});
      expect(semFiltro.total).toBe(3);
    });
  });

  describe("searchPriorizado", () => {
    it("ordena por prioridade: código exato → prefixo → contém → descrição", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const exato = await criarProduto({ descricao: "Zzz produto" });
      const prefixo = await criarProduto({ descricao: "Yyy produto" });
      const contem = await criarProduto({ descricao: "Xxx produto" });
      const porDescricao = await criarProduto({ descricao: "Produto com ABC" });

      await prismaTeste.produtoCodigo.createMany({
        data: [
          { id_produto: exato.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC" },
          { id_produto: prefixo.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC123" },
          { id_produto: contem.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "XXABCXX" },
        ],
      });

      const resultado = await produtoDAO.searchPriorizado("ABC");

      expect(resultado.map((p) => p.id_produto)).toEqual([
        exato.id_produto,
        prefixo.id_produto,
        contem.id_produto,
        porDescricao.id_produto,
      ]);
    });

    it("remove duplicados entre os lotes de prioridade", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const multi = await criarProduto({ descricao: "Multi" });
      await prismaTeste.produtoCodigo.createMany({
        data: [
          { id_produto: multi.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC1" },
          { id_produto: multi.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ZZABCZZ" },
        ],
      });

      const resultado = await produtoDAO.searchPriorizado("ABC");

      expect(resultado.map((p) => p.id_produto)).toEqual([multi.id_produto]);
    });

    it("respeita o limite de resultados", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const a = await criarProduto({ descricao: "A" });
      const b = await criarProduto({ descricao: "B" });
      await prismaTeste.produtoCodigo.createMany({
        data: [
          { id_produto: a.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC" },
          { id_produto: b.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC2" },
        ],
      });

      const resultado = await produtoDAO.searchPriorizado("ABC", 1);

      expect(resultado).toHaveLength(1);
    });
  });

  describe("searchPriorizadoComSaldo", () => {
    it("inclui o saldo do produto no resultado priorizado", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const produto = await criarProduto();
      await prismaTeste.produtoCodigo.create({
        data: { id_produto: produto.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC" },
      });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 8, saldoReservado: 2 });

      const resultado = await produtoDAO.searchPriorizadoComSaldo("ABC");

      expect(resultado).toHaveLength(1);
      expect(resultado[0]?.saldo).toBe(8);
      expect(resultado[0]?.saldo_reservado).toBe(2);
    });

    it("devolve a linha sem unidade, com os saldos do produto", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const caixa = await criarConversao("CX", 12);
      const comConversao = await criarProduto({
        descricao: "Com caixa",
        idConversaoPadrao: caixa.id_conversao,
      });
      const semConversao = await criarProduto({ descricao: "Sem caixa" });
      await prismaTeste.produtoCodigo.createMany({
        data: [
          { id_produto: comConversao.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC1" },
          { id_produto: semConversao.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC2" },
        ],
      });

      const resultado = await produtoDAO.searchPriorizadoComSaldo("ABC");
      const linhas = new Map(resultado.map((p) => [p.id_produto, produtoParaLinha(p)]));

      expect(linhas.get(comConversao.id_produto)).not.toHaveProperty("unidade");
      expect(linhas.get(semConversao.id_produto)).not.toHaveProperty("unidade");
      expect(resultado[0]).not.toHaveProperty("conversaoPadrao");
    });

    it("respeita os filtros da listagem na busca priorizada", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const outroTipo = await criarTipoCodigo("EAN13");
      const ativo = await criarProduto({ descricao: "Arroz ativo", perecivel: true });
      const inativo = await criarProduto({
        descricao: "Arroz inativo",
        perecivel: true,
        ativo: false,
      });
      const semPerecivel = await criarProduto({ descricao: "Arroz seco" });
      await prismaTeste.produtoCodigo.createMany({
        data: [
          { id_produto: ativo.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC1" },
          {
            id_produto: inativo.id_produto,
            id_tipo_codigo: tipo.id_tipo_codigo,
            codigo: "ABC2",
          },
          {
            id_produto: semPerecivel.id_produto,
            id_tipo_codigo: outroTipo.id_tipo_codigo,
            codigo: "ABC3",
          },
        ],
      });

      const padrao = await produtoDAO.searchPriorizadoComSaldo("ABC");
      expect(padrao.map((p) => p.id_produto)).toEqual([
        ativo.id_produto,
        semPerecivel.id_produto,
      ]);
      expect(padrao.every((p) => typeof p.ativo === "boolean")).toBe(true);

      const soInativos = await produtoDAO.searchPriorizadoComSaldo("ABC", 50, { ativo: false });
      expect(soInativos.map((p) => p.id_produto)).toEqual([inativo.id_produto]);

      const pereciveis = await produtoDAO.searchPriorizadoComSaldo("ABC", 50, {
        ativo: null,
        perecivel: true,
      });
      expect(pereciveis.map((p) => p.id_produto)).toEqual([
        ativo.id_produto,
        inativo.id_produto,
      ]);

      const doTipo = await produtoDAO.searchPriorizadoComSaldo("ABC", 50, {
        ativo: null,
        id_tipo_codigo: [tipo.id_tipo_codigo],
      });
      expect(doTipo.map((p) => p.id_produto)).toEqual([ativo.id_produto, inativo.id_produto]);
    });
  });

  describe("getById", () => {
    it("inclui conversão, códigos com tipo, saldo e insumos", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const pai = await criarProduto({ descricao: "Composto", composto: true });
      const filho = await criarProduto({ descricao: "Insumo" });
      await prismaTeste.produtoCodigo.create({
        data: { id_produto: pai.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "PAI" },
      });
      await prismaTeste.produtoInsumo.create({
        data: { id_produto_pai: pai.id_produto, id_produto_filho: filho.id_produto, quantidade: 3 },
      });
      await criarEstoque(pai.id_produto, { quantidadeAtual: 1 });

      const encontrado = await produtoDAO.getById(pai.id_produto);

      expect(encontrado?.produtoCodigos[0]?.tipoCodigo.nome).toBe("DIGITACAO");
      expect(encontrado?.saldo).toBe(1);
      expect(encontrado?.insumosPai).toHaveLength(1);
      expect(encontrado?.insumosPai[0]?.produtoFilho.descricao).toBe("Insumo");
    });

    it("retorna null quando não existe", async () => {
      expect(await produtoDAO.getById(999999)).toBeNull();
    });
  });

  describe("createCompleto", () => {
    it("cria produto com códigos e insumos e registra auditoria CRIAR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const insumo = await criarProduto({ descricao: "Farinha" });

      const criado = await produtoDAO.createCompleto(
        {
          descricao: "Bolo",
          perecivel: true,
          composto: true,
          data_validade: "2026-12-31",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "BOLO-1" }],
          insumos: [{ id_produto_filho: insumo.id_produto, quantidade: 2 }],
        },
        usuario.id_usuario,
      );

      expect(criado.descricao).toBe("Bolo");
      expect(criado.perecivel).toBe(true);
      expect(criado.produtoCodigos).toHaveLength(1);
      expect(criado.insumosPai).toHaveLength(1);
      expect(criado.insumosPai[0]?.quantidade).toBe(2);

      const auditorias = await auditoriasDe("Produto", criado.id_produto);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.dados_novos).toMatchObject({
        descricao: "Bolo",
        codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "BOLO-1" }],
      });
    });

    it("usa a unidade padrão quando o formulário não informa a unidade", async () => {
      const { usuario } = await criarUsuario();
      const padrao = await garantirUnidadePadrao();

      const criado = await produtoDAO.createCompleto(
        { descricao: "Sem unidade" },
        usuario.id_usuario,
      );

      expect(criado.id_conversao_padrao).toBe(padrao.id_conversao);
      expect(criado.id_conversao_saida).toBe(padrao.id_conversao);
      expect(criado.conversaoPadrao).toMatchObject({ nome: "UNIDADE" });
      expect(criado.conversaoSaida).toMatchObject({ nome: "UNIDADE" });
    });

    it("respeita as unidades explícitas de entrada e de saída", async () => {
      const { usuario } = await criarUsuario();
      const entrada = await criarConversao("CX12", 12);
      const saida = await criarConversao("CX50", 50);

      const criado = await produtoDAO.createCompleto(
        {
          descricao: "Com caixas",
          id_conversao_padrao: entrada.id_conversao,
          id_conversao_saida: saida.id_conversao,
        },
        usuario.id_usuario,
      );

      expect(criado.id_conversao_padrao).toBe(entrada.id_conversao);
      expect(criado.id_conversao_saida).toBe(saida.id_conversao);
      expect(criado.conversaoPadrao).toMatchObject({ nome: "CX12" });
      expect(criado.conversaoSaida).toMatchObject({ nome: "CX50" });
    });

    it("desfaz produto e anexo quando o callback da foto falha", async () => {
      const { usuario } = await criarUsuario();
      await garantirUnidadePadrao();

      await expect(
        produtoDAO.createCompleto(
          { descricao: "Falha atômica" },
          usuario.id_usuario,
          async (tx, idProduto) => {
            await tx.anexo.create({
              data: {
                id_produto: idProduto,
                nome_arquivo: "foto.webp",
                url: "/uploads/produtos/foto.webp",
                data_upload: new Date(),
              },
            });
            throw new Error("falha depois do anexo");
          },
        ),
      ).rejects.toThrow("falha depois do anexo");

      expect(
        await prismaTeste.produto.count({ where: { descricao: "Falha atômica" } }),
      ).toBe(0);
      expect(await prismaTeste.anexo.count()).toBe(0);
    });
  });

  describe("updateCompleto", () => {
    it("substitui códigos e insumos e registra auditoria ALTERAR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const insumoA = await criarProduto({ descricao: "Insumo A" });
      const insumoB = await criarProduto({ descricao: "Insumo B" });
      const saida = await criarConversao("CX50", 50);
      const criado = await produtoDAO.createCompleto(
        {
          descricao: "Original",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "OLD" }],
          insumos: [{ id_produto_filho: insumoA.id_produto, quantidade: 1 }],
        },
        usuario.id_usuario,
      );

      const atualizado = await produtoDAO.updateCompleto(
        criado.id_produto,
        {
          descricao: "Atualizado",
          composto: true,
          id_conversao_saida: saida.id_conversao,
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "NEW" }],
          insumos: [{ id_produto_filho: insumoB.id_produto, quantidade: 5 }],
        },
        usuario.id_usuario,
      );

      expect(atualizado.descricao).toBe("Atualizado");
      expect(atualizado.id_conversao_saida).toBe(saida.id_conversao);
      expect(atualizado.conversaoSaida).toMatchObject({ nome: "CX50" });
      expect(atualizado.produtoCodigos.map((c) => c.codigo)).toEqual(["NEW"]);
      expect(atualizado.insumosPai.map((i) => i.id_produto_filho)).toEqual([insumoB.id_produto]);

      const auditorias = await auditoriasDe("Produto", criado.id_produto);
      expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "ALTERAR"]);
      expect(auditorias[1]?.dados_anteriores).toMatchObject({ descricao: "Original", ativo: true });
      expect(auditorias[1]?.dados_novos).toMatchObject({ descricao: "Atualizado", ativo: true });
    });

    it("registra DESATIVAR quando ativo vira false", async () => {
      const { usuario } = await criarUsuario();
      const criado = await criarProduto({ descricao: "Produto" });

      await produtoDAO.updateCompleto(criado.id_produto, { ativo: false }, usuario.id_usuario);

      const auditorias = await auditoriasDe("Produto", criado.id_produto);
      expect(auditorias.map((a) => a.acao)).toEqual(["DESATIVAR"]);
      expect(auditorias[0]?.dados_novos).toMatchObject({ ativo: false });
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir produto sem vínculos", async () => {
      const produto = await criarProduto();

      const resultado = await produtoDAO.verificarRelacionamentos(produto.id_produto);

      expect(resultado.podeExcluir).toBe(true);
      expect(resultado.vinculos).toEqual([]);
    });

    it("bloqueia quando há estoque, item de nota de entrada ou insumo que o usa", async () => {
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 1 });
      const nota = await criarNotaEntrada();
      await prismaTeste.itemNotaEntrada.create({
        data: {
          id_nota_entrada: nota.id_nota_entrada,
          id_produto: produto.id_produto,
          quantidade: 1,
        },
      });
      const composto = await criarProduto({ composto: true });
      await prismaTeste.produtoInsumo.create({
        data: { id_produto_pai: composto.id_produto, id_produto_filho: produto.id_produto, quantidade: 1 },
      });

      const resultado = await produtoDAO.verificarRelacionamentos(produto.id_produto);

      expect(resultado.podeExcluir).toBe(false);
      expect(resultado.vinculos.join(" | ")).toContain("saldo de estoque");
      expect(resultado.vinculos.join(" | ")).toContain("item(ns) de nota de entrada");
      expect(resultado.vinculos.join(" | ")).toContain("insumo");
    });
  });

  describe("hardDelete", () => {
    it("exclui produto sem vínculos, remove códigos/insumos e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const insumo = await criarProduto();
      const criado = await produtoDAO.createCompleto(
        {
          descricao: "Descartável",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "DEL" }],
          insumos: [{ id_produto_filho: insumo.id_produto, quantidade: 1 }],
        },
        usuario.id_usuario,
      );

      await produtoDAO.hardDelete(criado.id_produto, usuario.id_usuario);

      expect(
        await prismaTeste.produto.findUnique({ where: { id_produto: criado.id_produto } }),
      ).toBeNull();
      expect(await prismaTeste.produtoCodigo.count({ where: { id_produto: criado.id_produto } })).toBe(0);
      expect(
        await prismaTeste.produtoInsumo.count({ where: { id_produto_pai: criado.id_produto } }),
      ).toBe(0);

      const auditorias = await auditoriasDe("Produto", criado.id_produto);
      expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há estoque", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 1 });

      await expect(
        produtoDAO.hardDelete(produto.id_produto, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
      expect(
        await prismaTeste.produto.findUnique({ where: { id_produto: produto.id_produto } }),
      ).not.toBeNull();
    });
  });
});
