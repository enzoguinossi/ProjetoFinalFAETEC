import { describe, expect, it } from "vitest";
import { destinatarioDAO } from "@/dao/destinatario";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarColeta,
  criarDestinatario,
  criarNotaSaida,
  criarPedidoEscola,
  criarPercursoComDestinatario,
  criarRemessa,
  criarTipoCodigo,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("destinatarioDAO", () => {
  describe("list", () => {
    it("pagina, busca por razão social e ignora inativos", async () => {
      await criarDestinatario({ razaoSocial: "Escola Alfa" });
      await criarDestinatario({ razaoSocial: "Creche Beta" });
      await criarDestinatario({ razaoSocial: "Escola Gama", ativo: false });

      const todos = await destinatarioDAO.list({ page: 1, limit: 1 });
      expect(todos.total).toBe(2);
      expect(todos.totalPages).toBe(2);
      expect(todos.data[0]).toHaveProperty("pessoaJuridica");
      expect(todos.data[0]).toHaveProperty("endereco");

      const busca = await destinatarioDAO.list({ search: "Beta" });
      expect(busca.total).toBe(1);
      expect(busca.data[0]?.pessoaJuridica.razao_social).toBe("Creche Beta");
    });
  });

  describe("getById", () => {
    it("inclui pessoa jurídica, endereço, contatos ativos e códigos", async () => {
      const { destinatario } = await criarDestinatario();
      const tipo = await criarTipoCodigo("COD_ESCOLA");
      await prismaTeste.destinatarioCodigo.create({
        data: { id_destinatario: destinatario.id_destinatario, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ESC-1" },
      });
      await prismaTeste.destinatarioEmail.create({
        data: { id_destinatario: destinatario.id_destinatario, endereco: "escola@edu.br", principal: true },
      });
      await prismaTeste.destinatarioTelefone.create({
        data: { id_destinatario: destinatario.id_destinatario, numero: "2122223333", tipo: "FIXO", principal: true },
      });
      await prismaTeste.destinatarioTelefone.create({
        data: { id_destinatario: destinatario.id_destinatario, numero: "21999999999", tipo: "CELULAR", ativo: false },
      });

      const encontrado = await destinatarioDAO.getById(destinatario.id_destinatario);

      expect(encontrado?.pessoaJuridica.razao_social).toBeDefined();
      expect(encontrado?.endereco.cidade).toBe("Rio de Janeiro");
      expect(encontrado?.telefones).toHaveLength(1);
      expect(encontrado?.emails).toHaveLength(1);
      expect(encontrado?.destinatarioCodigos[0]?.codigo).toBe("ESC-1");
    });

    it("retorna null quando não existe", async () => {
      expect(await destinatarioDAO.getById(999999)).toBeNull();
    });
  });

  describe("create", () => {
    it("cria pessoa jurídica, endereço, contatos e códigos com duas auditorias", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("COD_ESCOLA");

      const criado = await destinatarioDAO.create(
        {
          razao_social: "Escola Nova",
          cnpj: "11222333000144",
          tipo_destinatario: "CRECHE",
          endereco: { logradouro: "Rua A", numero: "10", cidade: "Niterói", uf: "RJ" },
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ESC-2" }],
          emails: [{ endereco: "nova@edu.br", principal: true }],
          telefones: [{ numero: "21988887777", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      expect(criado.pessoaJuridica.razao_social).toBe("Escola Nova");
      expect(criado.endereco.cidade).toBe("Niterói");

      const auditoriasPj = await auditoriasDe("PessoaJuridica", criado.id_pessoa_juridica);
      const auditoriasDest = await auditoriasDe("Destinatario", criado.id_destinatario);
      expect(auditoriasPj.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasDest.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasDest[0]?.dados_novos).toMatchObject({ tipo: "CRECHE" });
    });
  });

  describe("update", () => {
    it("altera dados, atualiza endereço parcialmente e substitui listas", async () => {
      const { usuario } = await criarUsuario();
      const { destinatario } = await criarDestinatario({ razaoSocial: "Antiga" });

      await destinatarioDAO.update(
        destinatario.id_destinatario,
        {
          razao_social: "Nova",
          tipo_destinatario: "CRECHE",
          ativo: true,
          endereco: { cidade: "São Gonçalo" },
          emails: [{ endereco: "nova@edu.br", principal: true }],
          telefones: [{ numero: "21977776666", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      const noBanco = await destinatarioDAO.getById(destinatario.id_destinatario);
      expect(noBanco?.pessoaJuridica.razao_social).toBe("Nova");
      expect(noBanco?.tipo_destinatario).toBe("CRECHE");
      expect(noBanco?.endereco.cidade).toBe("São Gonçalo");
      expect(noBanco?.endereco.logradouro).toContain("Rua");
      expect(noBanco?.emails.map((e) => e.endereco)).toEqual(["nova@edu.br"]);

      const auditorias = await auditoriasDe("Destinatario", destinatario.id_destinatario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ razao_social: "Antiga" });
      expect(auditorias[0]?.dados_novos).toMatchObject({ razao_social: "Nova" });
    });

    it("registra DESATIVAR quando ativo vira false", async () => {
      const { usuario } = await criarUsuario();
      const { destinatario } = await criarDestinatario();

      await destinatarioDAO.update(destinatario.id_destinatario, { ativo: false }, usuario.id_usuario);

      const auditorias = await auditoriasDe("Destinatario", destinatario.id_destinatario);
      expect(auditorias.map((a) => a.acao)).toEqual(["DESATIVAR"]);
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir destinatário sem vínculos", async () => {
      const { destinatario } = await criarDestinatario();

      const resultado = await destinatarioDAO.verificarRelacionamentos(destinatario.id_destinatario);

      expect(resultado.podeExcluir).toBe(true);
      expect(resultado.vinculos).toEqual([]);
    });

    it("bloqueia quando há pedidos, remessas, coletas ou percursos", async () => {
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida();
      await criarPedidoEscola(destinatario.id_destinatario);
      await criarRemessa({
        idNotaSaida: nota.id_nota_saida,
        idDestinatario: destinatario.id_destinatario,
      });
      await criarColeta(nota.id_nota_saida, destinatario.id_destinatario);
      await criarPercursoComDestinatario(destinatario.id_destinatario);

      const resultado = await destinatarioDAO.verificarRelacionamentos(destinatario.id_destinatario);

      expect(resultado.podeExcluir).toBe(false);
      const texto = resultado.vinculos.join(" | ");
      expect(texto).toContain("pedido(s)");
      expect(texto).toContain("remessa(s)");
      expect(texto).toContain("coleta(s)");
      expect(texto).toContain("percurso(s)");
    });
  });

  describe("hardDelete", () => {
    it("exclui destinatário, endereço e pessoa jurídica com auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const { destinatario, pessoaJuridica, endereco } = await criarDestinatario();

      await destinatarioDAO.hardDelete(destinatario.id_destinatario, usuario.id_usuario);

      expect(
        await prismaTeste.destinatario.findUnique({
          where: { id_destinatario: destinatario.id_destinatario },
        }),
      ).toBeNull();
      expect(
        await prismaTeste.endereco.findUnique({ where: { id_endereco: endereco.id_endereco } }),
      ).toBeNull();
      expect(
        await prismaTeste.pessoaJuridica.findUnique({
          where: { id_pessoa_juridica: pessoaJuridica.id_pessoa_juridica },
        }),
      ).toBeNull();

      const auditorias = await auditoriasDe("Destinatario", destinatario.id_destinatario);
      expect(auditorias.map((a) => a.acao)).toEqual(["EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há vínculos", async () => {
      const { usuario } = await criarUsuario();
      const { destinatario } = await criarDestinatario();
      await criarPedidoEscola(destinatario.id_destinatario);

      await expect(
        destinatarioDAO.hardDelete(destinatario.id_destinatario, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
    });
  });
});
