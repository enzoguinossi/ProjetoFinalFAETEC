import { describe, expect, it } from "vitest";
import { destinatarioDAO } from "@/dao/destinatario";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarColeta,
  criarDestinatario,
  criarNotaSaida,
  criarPedidoEscola,
  criarPercursoComDestinatario,
  criarTipoCodigo,
  criarTipoDestinatario,
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

    it("filtra por tipo e UF, combinados com a busca, sem expor inativos", async () => {
      const tipoEscola = await criarTipoDestinatario("Escola");
      const tipoCreche = await criarTipoDestinatario("Creche");
      const tipoCmei = await criarTipoDestinatario("CMEI");
      const escolaRj = await criarDestinatario({
        razaoSocial: "Escola Alfa",
        idTipoDestinatario: tipoEscola.id_tipo_destinatario,
        uf: "RJ",
      });
      const crecheSp = await criarDestinatario({
        razaoSocial: "Creche Alfa",
        idTipoDestinatario: tipoCreche.id_tipo_destinatario,
        uf: "SP",
      });
      const cmeiRj = await criarDestinatario({
        razaoSocial: "CMEI Alfa",
        idTipoDestinatario: tipoCmei.id_tipo_destinatario,
        uf: "RJ",
      });
      await criarDestinatario({
        razaoSocial: "Escola Alfa Inativa",
        idTipoDestinatario: tipoEscola.id_tipo_destinatario,
        uf: "RJ",
        ativo: false,
      });

      const porTipo = await destinatarioDAO.list({
        tipos: [tipoCreche.id_tipo_destinatario, tipoCmei.id_tipo_destinatario],
      });
      expect(porTipo.data.map((d) => d.id_destinatario).sort((a, b) => a - b)).toEqual(
        [
          crecheSp.destinatario.id_destinatario,
          cmeiRj.destinatario.id_destinatario,
        ].sort((a, b) => a - b),
      );

      const porUf = await destinatarioDAO.list({ ufs: ["SP"] });
      expect(porUf.data.map((d) => d.id_destinatario)).toEqual([
        crecheSp.destinatario.id_destinatario,
      ]);

      const combinado = await destinatarioDAO.list({
        tipos: [tipoEscola.id_tipo_destinatario],
        ufs: ["RJ"],
      });
      expect(combinado.data.map((d) => d.id_destinatario)).toEqual([
        escolaRj.destinatario.id_destinatario,
      ]);

      const comBusca = await destinatarioDAO.list({
        tipos: [tipoEscola.id_tipo_destinatario],
        ufs: ["RJ"],
        search: "Alfa",
      });
      expect(comBusca.data.map((d) => d.id_destinatario)).toEqual([
        escolaRj.destinatario.id_destinatario,
      ]);
    });

    it("filtra por situação: default só ativos, inativos e todos", async () => {
      const ativo = await criarDestinatario({ razaoSocial: "Escola Ativa" });
      const inativo = await criarDestinatario({
        razaoSocial: "Escola Inativa",
        ativo: false,
      });

      const padrao = await destinatarioDAO.list({});
      expect(padrao.data.map((d) => d.id_destinatario)).toEqual([
        ativo.destinatario.id_destinatario,
      ]);

      const inativos = await destinatarioDAO.list({ ativo: false });
      expect(inativos.data.map((d) => d.id_destinatario)).toEqual([
        inativo.destinatario.id_destinatario,
      ]);

      const todos = await destinatarioDAO.list({ ativo: null });
      expect(todos.data.map((d) => d.id_destinatario).sort((a, b) => a - b)).toEqual(
        [ativo.destinatario.id_destinatario, inativo.destinatario.id_destinatario].sort(
          (a, b) => a - b,
        ),
      );
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
      const tipoDestinatario = await criarTipoDestinatario("Creche");

      const criado = await destinatarioDAO.create(
        {
          razao_social: "Escola Nova",
          nome_fantasia: "Escolinha Nova",
          cnpj: "11222333000144",
          id_tipo_destinatario: tipoDestinatario.id_tipo_destinatario,
          endereco: { logradouro: "Rua A", numero: "10", cidade: "Niterói", uf: "RJ" },
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ESC-2" }],
          emails: [{ endereco: "nova@edu.br", principal: true }],
          telefones: [{ numero: "21988887777", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      expect(criado.pessoaJuridica.razao_social).toBe("Escola Nova");
      expect(criado.pessoaJuridica.nome_fantasia).toBe("Escolinha Nova");
      expect(criado.endereco.cidade).toBe("Niterói");

      const auditoriasPj = await auditoriasDe("PessoaJuridica", criado.id_pessoa_juridica);
      const auditoriasDest = await auditoriasDe("Destinatario", criado.id_destinatario);
      expect(auditoriasPj.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasPj[0]?.dados_novos).toMatchObject({
        razao_social: "Escola Nova",
        nome_fantasia: "Escolinha Nova",
      });
      expect(auditoriasDest.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasDest[0]?.dados_novos).toMatchObject({
        tipo: {
          id: tipoDestinatario.id_tipo_destinatario,
          nome: "Creche",
        },
      });
    });

    it("cria destinatário sem tipo quando o id é null", async () => {
      const { usuario } = await criarUsuario();

      const criado = await destinatarioDAO.create(
        {
          razao_social: "Escola Sem Tipo",
          id_tipo_destinatario: null,
          endereco: { logradouro: "Rua B", cidade: "Niterói" },
        },
        usuario.id_usuario,
      );

      expect(criado.id_tipo_destinatario).toBeNull();
      expect(criado.tipoDestinatario).toBeNull();
      const auditorias = await auditoriasDe("Destinatario", criado.id_destinatario);
      expect(auditorias[0]?.dados_novos).toMatchObject({ tipo: null });
    });

    it("recusa tipo inexistente sem gravar cadastro", async () => {
      const { usuario } = await criarUsuario();

      await expect(
        destinatarioDAO.create(
          {
            razao_social: "Escola Inválida",
            id_tipo_destinatario: 999999,
            endereco: { logradouro: "Rua C", cidade: "Niterói" },
          },
          usuario.id_usuario,
        ),
      ).rejects.toThrowError("Tipo de escola não encontrado.");
      expect(await prismaTeste.destinatario.count()).toBe(0);
      expect(await prismaTeste.pessoaJuridica.count()).toBe(0);
    });
  });

  describe("update", () => {
    it("altera dados, atualiza endereço parcialmente e substitui listas", async () => {
      const { usuario } = await criarUsuario();
      const tipoCreche = await criarTipoDestinatario("Creche");
      const { destinatario } = await criarDestinatario({
        razaoSocial: "Antiga",
        nomeFantasia: "Fantasia Antiga",
      });

      await destinatarioDAO.update(
        destinatario.id_destinatario,
        {
          razao_social: "Nova",
          nome_fantasia: "Fantasia Nova",
          id_tipo_destinatario: tipoCreche.id_tipo_destinatario,
          ativo: true,
          endereco: { cidade: "São Gonçalo" },
          emails: [{ endereco: "nova@edu.br", principal: true }],
          telefones: [{ numero: "21977776666", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      const noBanco = await destinatarioDAO.getById(destinatario.id_destinatario);
      expect(noBanco?.pessoaJuridica.razao_social).toBe("Nova");
      expect(noBanco?.pessoaJuridica.nome_fantasia).toBe("Fantasia Nova");
      expect(noBanco?.id_tipo_destinatario).toBe(tipoCreche.id_tipo_destinatario);
      expect(noBanco?.tipoDestinatario?.nome).toBe("Creche");
      expect(noBanco?.endereco.cidade).toBe("São Gonçalo");
      expect(noBanco?.endereco.logradouro).toContain("Rua");
      expect(noBanco?.emails.map((e) => e.endereco)).toEqual(["nova@edu.br"]);

      const auditorias = await auditoriasDe("Destinatario", destinatario.id_destinatario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        razao_social: "Antiga",
        nome_fantasia: "Fantasia Antiga",
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({
        razao_social: "Nova",
        nome_fantasia: "Fantasia Nova",
        tipo: { id: tipoCreche.id_tipo_destinatario, nome: "Creche" },
      });
    });

    it("remove o tipo quando recebe null", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoDestinatario("Escola");
      const { destinatario } = await criarDestinatario({
        idTipoDestinatario: tipo.id_tipo_destinatario,
      });

      await destinatarioDAO.update(
        destinatario.id_destinatario,
        { id_tipo_destinatario: null },
        usuario.id_usuario,
      );

      const noBanco = await destinatarioDAO.getById(destinatario.id_destinatario);
      expect(noBanco?.id_tipo_destinatario).toBeNull();
      expect(noBanco?.tipoDestinatario).toBeNull();
      const auditorias = await auditoriasDe("Destinatario", destinatario.id_destinatario);
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        tipo: { id: tipo.id_tipo_destinatario, nome: "Escola" },
      });
      expect(auditorias[0]?.dados_novos).toMatchObject({ tipo: null });
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

    it("bloqueia quando há pedidos, notas de saída, coletas ou percursos", async () => {
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida({ idDestinatario: destinatario.id_destinatario });
      await criarPedidoEscola(destinatario.id_destinatario);
      await criarColeta(nota.id_nota_saida, destinatario.id_destinatario);
      await criarPercursoComDestinatario(destinatario.id_destinatario);

      const resultado = await destinatarioDAO.verificarRelacionamentos(destinatario.id_destinatario);

      expect(resultado.podeExcluir).toBe(false);
      const texto = resultado.vinculos.join(" | ");
      expect(texto).toContain("pedido(s)");
      expect(texto).toContain("nota(s) de saída");
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
