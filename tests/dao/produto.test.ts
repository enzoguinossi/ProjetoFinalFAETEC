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

    it("inclui conversão padrão e apenas estoques ativos", async () => {
      const produto = await criarProduto();
      await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 99, ativo: false });

      const resultado = await produtoDAO.list({});

      expect(resultado.data[0]?.estoques).toHaveLength(1);
      expect(resultado.data[0]?.estoques[0]?.quantidade_atual).toBe(10);
      expect(resultado.data[0]).toHaveProperty("conversaoPadrao");
    });

    it("exclui os ids informados e mantém o total coerente", async () => {
      const manter = await criarProduto({ descricao: "Manter" });
      const excluir = await criarProduto({ descricao: "Excluir" });

      const resultado = await produtoDAO.list({ page: 1, limit: 10 }, [excluir.id_produto]);

      expect(resultado.total).toBe(1);
      expect(resultado.totalPages).toBe(1);
      expect(resultado.data.map((p) => p.id_produto)).toEqual([manter.id_produto]);
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

  describe("searchPriorizadoComEstoque", () => {
    it("inclui os estoques ativos no resultado priorizado", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const produto = await criarProduto();
      await prismaTeste.produtoCodigo.create({
        data: { id_produto: produto.id_produto, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC" },
      });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 8, saldoReservado: 2 });
      await criarEstoque(produto.id_produto, { quantidadeAtual: 50, ativo: false });

      const resultado = await produtoDAO.searchPriorizadoComEstoque("ABC");

      expect(resultado).toHaveLength(1);
      expect(resultado[0]?.estoques).toEqual([
        { quantidade_atual: 8, saldo_reservado: 2 },
      ]);
    });

    it("devolve a unidade de conversão padrão na busca priorizada (mesma forma do list)", async () => {
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

      const resultado = await produtoDAO.searchPriorizadoComEstoque("ABC");
      const linhas = new Map(resultado.map((p) => [p.id_produto, produtoParaLinha(p)]));

      expect(linhas.get(comConversao.id_produto)?.unidade).toBe("CX");
      expect(linhas.get(semConversao.id_produto)?.unidade).toBe("UN");
    });
  });

  describe("getById", () => {
    it("inclui conversão, códigos com tipo, estoques ativos e insumos", async () => {
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
      await criarEstoque(pai.id_produto, { quantidadeAtual: 9, ativo: false });

      const encontrado = await produtoDAO.getById(pai.id_produto);

      expect(encontrado?.produtoCodigos[0]?.tipoCodigo.nome).toBe("DIGITACAO");
      expect(encontrado?.estoques).toHaveLength(1);
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
  });

  describe("updateCompleto", () => {
    it("substitui códigos e insumos e registra auditoria ALTERAR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const insumoA = await criarProduto({ descricao: "Insumo A" });
      const insumoB = await criarProduto({ descricao: "Insumo B" });
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
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "NEW" }],
          insumos: [{ id_produto_filho: insumoB.id_produto, quantidade: 5 }],
        },
        usuario.id_usuario,
      );

      expect(atualizado.descricao).toBe("Atualizado");
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
          quantidade_convertida: 1,
        },
      });
      const composto = await criarProduto({ composto: true });
      await prismaTeste.produtoInsumo.create({
        data: { id_produto_pai: composto.id_produto, id_produto_filho: produto.id_produto, quantidade: 1 },
      });

      const resultado = await produtoDAO.verificarRelacionamentos(produto.id_produto);

      expect(resultado.podeExcluir).toBe(false);
      expect(resultado.vinculos.join(" | ")).toContain("registro(s) de estoque");
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

  describe("setFotoUrl", () => {
    it("atualiza a foto e registra auditoria ALTERAR com antes/depois", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();

      await produtoDAO.setFotoUrl(produto.id_produto, "/uploads/produtos/1/foto.webp", usuario.id_usuario);

      const noBanco = await prismaTeste.produto.findUniqueOrThrow({
        where: { id_produto: produto.id_produto },
      });
      expect(noBanco.foto_url).toBe("/uploads/produtos/1/foto.webp");

      const auditorias = await auditoriasDe("Produto", produto.id_produto);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ foto_url: null });
      expect(auditorias[0]?.dados_novos).toMatchObject({ foto_url: "/uploads/produtos/1/foto.webp" });
    });
  });

  describe("rollbackCreate", () => {
    it("remove produto recém-criado (com códigos e insumos) e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const insumo = await criarProduto();
      const criado = await produtoDAO.createCompleto(
        {
          descricao: "Rollback",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "RB" }],
          insumos: [{ id_produto_filho: insumo.id_produto, quantidade: 1 }],
        },
        usuario.id_usuario,
      );

      await produtoDAO.rollbackCreate(criado.id_produto, usuario.id_usuario);

      expect(
        await prismaTeste.produto.findUnique({ where: { id_produto: criado.id_produto } }),
      ).toBeNull();
      expect(await prismaTeste.produtoCodigo.count({ where: { id_produto: criado.id_produto } })).toBe(0);
      expect(
        await prismaTeste.produtoInsumo.count({ where: { id_produto_pai: criado.id_produto } }),
      ).toBe(0);

      const auditorias = await auditoriasDe("Produto", criado.id_produto);
      expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "EXCLUIR"]);
      expect(auditorias[1]?.dados_anteriores).toMatchObject({ descricao: "Rollback" });
    });
  });
});
