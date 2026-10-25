import { describe, expect, it } from "vitest";
import { fornecedorDAO } from "@/dao/fornecedor";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarFornecedor,
  criarNotaEntrada,
  criarTipoCodigo,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("fornecedorDAO", () => {
  describe("list", () => {
    it("pagina, busca por razão social e ignora inativos", async () => {
      await criarFornecedor({ razaoSocial: "Distribuidora Alfa" });
      await criarFornecedor({ razaoSocial: "Atacadão Beta" });
      await criarFornecedor({ razaoSocial: "Alfa Inativa", ativo: false });

      const todos = await fornecedorDAO.list({ page: 1, limit: 1 });
      expect(todos.total).toBe(2);
      expect(todos.totalPages).toBe(2);

      const busca = await fornecedorDAO.list({ search: "Beta" });
      expect(busca.total).toBe(1);
      expect(busca.data[0]?.pessoaJuridica.razao_social).toBe("Atacadão Beta");
    });
  });

  describe("getById", () => {
    it("inclui pessoa jurídica, endereço, contatos e códigos", async () => {
      const { fornecedor } = await criarFornecedor({ comEndereco: true });
      const tipo = await criarTipoCodigo("DIGITACAO");
      await prismaTeste.fornecedorCodigo.create({
        data: { id_fornecedor: fornecedor.id_fornecedor, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "FOR-1" },
      });
      await prismaTeste.fornecedorEmail.create({
        data: { id_fornecedor: fornecedor.id_fornecedor, endereco: "vendas@for.com", principal: true },
      });

      const encontrado = await fornecedorDAO.getById(fornecedor.id_fornecedor);

      expect(encontrado?.pessoaJuridica.razao_social).toBeDefined();
      expect(encontrado?.endereco?.cidade).toBe("Rio de Janeiro");
      expect(encontrado?.emails).toHaveLength(1);
      expect(encontrado?.fornecedorCodigos[0]?.codigo).toBe("FOR-1");
    });

    it("retorna null quando não existe", async () => {
      expect(await fornecedorDAO.getById(999999)).toBeNull();
    });
  });

  describe("create", () => {
    it("cria fornecedor com endereço, contatos e códigos com duas auditorias", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");

      const criado = await fornecedorDAO.create(
        {
          razao_social: "Fornecedor Novo",
          cnpj: "99888777000166",
          endereco: { logradouro: "Av Central", cidade: "Duque de Caxias", uf: "RJ" },
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "FOR-2" }],
          emails: [{ endereco: "novo@for.com", principal: true }],
          telefones: [{ numero: "21966665555", tipo: "COMERCIAL", principal: true }],
        },
        usuario.id_usuario,
      );

      expect(criado.pessoaJuridica.razao_social).toBe("Fornecedor Novo");
      expect(criado.endereco?.logradouro).toBe("Av Central");

      const auditoriasPj = await auditoriasDe("PessoaJuridica", criado.id_pessoa_juridica);
      const auditoriasForn = await auditoriasDe("Fornecedor", criado.id_fornecedor);
      expect(auditoriasPj.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasForn.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasForn[0]?.dados_novos).toMatchObject({
        emails: [{ endereco: "novo@for.com", principal: true }],
      });
    });

    it("cria fornecedor sem endereço", async () => {
      const { usuario } = await criarUsuario();

      const criado = await fornecedorDAO.create(
        { razao_social: "Sem Endereço" },
        usuario.id_usuario,
      );

      expect(criado.id_endereco).toBeNull();
      expect(criado.endereco).toBeNull();
    });
  });

  describe("update", () => {
    it("altera dados e substitui listas com auditoria ALTERAR", async () => {
      const { usuario } = await criarUsuario();
      const { fornecedor } = await criarFornecedor({ razaoSocial: "Antigo", comEndereco: true });

      await fornecedorDAO.update(
        fornecedor.id_fornecedor,
        {
          razao_social: "Novo",
          ativo: true,
          emails: [{ endereco: "novo@for.com", principal: true }],
        },
        usuario.id_usuario,
      );

      const noBanco = await fornecedorDAO.getById(fornecedor.id_fornecedor);
      expect(noBanco?.pessoaJuridica.razao_social).toBe("Novo");
      expect(noBanco?.ativo).toBe(true);
      expect(noBanco?.emails.map((e) => e.endereco)).toEqual(["novo@for.com"]);

      const auditorias = await auditoriasDe("Fornecedor", fornecedor.id_fornecedor);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ razao_social: "Antigo" });
      expect(auditorias[0]?.dados_novos).toMatchObject({ razao_social: "Novo" });
    });

    it("atualiza endereço existente e substitui telefones", async () => {
      const { usuario } = await criarUsuario();
      const { fornecedor } = await criarFornecedor({ comEndereco: true });
      await prismaTeste.fornecedorTelefone.create({
        data: {
          id_fornecedor: fornecedor.id_fornecedor,
          numero: "21999998888",
          tipo: "CELULAR",
          principal: true,
        },
      });

      await fornecedorDAO.update(
        fornecedor.id_fornecedor,
        {
          endereco: { numero: "500" },
          telefones: [{ numero: "2133334444", tipo: "COMERCIAL", principal: true }],
        },
        usuario.id_usuario,
      );

      const noBanco = await fornecedorDAO.getById(fornecedor.id_fornecedor);
      expect(noBanco?.endereco?.numero).toBe("500");
      expect(noBanco?.endereco?.logradouro).toContain("Av");
      expect(noBanco?.telefones.map((t) => t.numero)).toEqual(["2133334444"]);
    });

    it("cria endereço quando o fornecedor ainda não tem e registra DESATIVAR ao inativar", async () => {
      const { usuario } = await criarUsuario();
      const { fornecedor } = await criarFornecedor({ comEndereco: false });

      await fornecedorDAO.update(
        fornecedor.id_fornecedor,
        {
          ativo: false,
          endereco: { logradouro: "Rua Nova", cidade: "Niterói" },
        },
        usuario.id_usuario,
      );

      const noBanco = await fornecedorDAO.getById(fornecedor.id_fornecedor);
      expect(noBanco?.endereco?.logradouro).toBe("Rua Nova");
      expect(noBanco?.ativo).toBe(false);

      const auditorias = await auditoriasDe("Fornecedor", fornecedor.id_fornecedor);
      expect(auditorias.map((a) => a.acao)).toEqual(["DESATIVAR"]);
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir fornecedor sem vínculos", async () => {
      const { fornecedor } = await criarFornecedor();

      const resultado = await fornecedorDAO.verificarRelacionamentos(fornecedor.id_fornecedor);

      expect(resultado.podeExcluir).toBe(true);
      expect(resultado.vinculos).toEqual([]);
    });

    it("bloqueia quando há nota de entrada", async () => {
      const { fornecedor } = await criarFornecedor();
      await criarNotaEntrada(fornecedor.id_fornecedor);

      const resultado = await fornecedorDAO.verificarRelacionamentos(fornecedor.id_fornecedor);

      expect(resultado.podeExcluir).toBe(false);
      expect(resultado.vinculos[0]).toContain("nota(s) de entrada");
    });
  });

  describe("hardDelete", () => {
    it("exclui fornecedor, endereço e pessoa jurídica com auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const { fornecedor, pessoaJuridica, endereco } = await criarFornecedor({ comEndereco: true });

      await fornecedorDAO.hardDelete(fornecedor.id_fornecedor, usuario.id_usuario);

      expect(
        await prismaTeste.fornecedor.findUnique({
          where: { id_fornecedor: fornecedor.id_fornecedor },
        }),
      ).toBeNull();
      expect(
        await prismaTeste.endereco.findUnique({
          where: { id_endereco: endereco!.id_endereco },
        }),
      ).toBeNull();
      expect(
        await prismaTeste.pessoaJuridica.findUnique({
          where: { id_pessoa_juridica: pessoaJuridica.id_pessoa_juridica },
        }),
      ).toBeNull();

      const auditorias = await auditoriasDe("Fornecedor", fornecedor.id_fornecedor);
      expect(auditorias.map((a) => a.acao)).toEqual(["EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há nota de entrada", async () => {
      const { usuario } = await criarUsuario();
      const { fornecedor } = await criarFornecedor();
      await criarNotaEntrada(fornecedor.id_fornecedor);

      await expect(
        fornecedorDAO.hardDelete(fornecedor.id_fornecedor, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
    });
  });
});
