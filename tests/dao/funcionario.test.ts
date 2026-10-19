import { describe, expect, it } from "vitest";
import { funcionarioDAO } from "@/dao/funcionario";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarContagem,
  criarDestinatario,
  criarFuncionario,
  criarInventarioComItem,
  criarNotaSaida,
  criarRemessa,
  criarTipoCodigo,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("funcionarioDAO", () => {
  describe("list", () => {
    it("pagina, busca por nome e ignora inativos", async () => {
      await criarUsuario({ nome: "Ana Silva" });
      await criarUsuario({ nome: "Bruno Souza" });
      await prismaTeste.funcionario.updateMany({ where: {}, data: { ativo: true } });
      const inativo = await criarUsuario({ nome: "Carlos Inativo" });
      await prismaTeste.funcionario.update({
        where: { id_funcionario: inativo.funcionario.id_funcionario },
        data: { ativo: false },
      });

      const todos = await funcionarioDAO.list({ page: 1, limit: 2 });
      expect(todos.total).toBe(2);
      expect(todos.data[0]).toHaveProperty("pessoaFisica");
      expect(todos.data[0]).toHaveProperty("usuario");

      const busca = await funcionarioDAO.list({ search: "Bruno" });
      expect(busca.total).toBe(1);
      expect(busca.data[0]?.pessoaFisica.nome).toBe("Bruno Souza");
    });
  });

  describe("getById", () => {
    it("inclui pessoa física, usuário, contatos ativos e códigos", async () => {
      const { funcionario } = await criarUsuario({ nome: "Completo" });
      const tipo = await criarTipoCodigo("MATRICULA");
      await prismaTeste.funcionarioCodigo.create({
        data: { id_funcionario: funcionario.id_funcionario, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "MAT-1" },
      });
      await prismaTeste.funcionarioEmail.create({
        data: { id_funcionario: funcionario.id_funcionario, endereco: "a@b.com", principal: true },
      });
      await prismaTeste.funcionarioTelefone.create({
        data: { id_funcionario: funcionario.id_funcionario, numero: "21999999999", tipo: "CELULAR", principal: true },
      });
      await prismaTeste.funcionarioTelefone.create({
        data: { id_funcionario: funcionario.id_funcionario, numero: "2133333333", tipo: "FIXO", ativo: false },
      });

      const encontrado = await funcionarioDAO.getById(funcionario.id_funcionario);

      expect(encontrado?.pessoaFisica.nome).toBe("Completo");
      expect(encontrado?.usuario).not.toBeNull();
      expect(encontrado?.telefones).toHaveLength(1);
      expect(encontrado?.emails).toHaveLength(1);
      expect(encontrado?.funcionarioCodigos[0]?.tipoCodigo.nome).toBe("MATRICULA");
    });

    it("retorna null quando não existe", async () => {
      expect(await funcionarioDAO.getById(999999)).toBeNull();
    });
  });

  describe("listDisponiveisParaUsuario", () => {
    it("retorna apenas funcionários sem usuário vinculado", async () => {
      await criarUsuario();
      const { funcionario: semUsuario } = await criarUsuario({ nome: "Sem Usuário" });
      await prismaTeste.usuario.delete({ where: { id_funcionario: semUsuario.id_funcionario } });

      const disponiveis = await funcionarioDAO.listDisponiveisParaUsuario();

      expect(disponiveis.map((f) => f.pessoaFisica.nome)).toEqual(["Sem Usuário"]);
    });
  });

  describe("create", () => {
    it("cria pessoa física, funcionário, contatos e códigos com duas auditorias", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("MATRICULA");

      const criado = await funcionarioDAO.create(
        {
          nome: "Novo Funcionário",
          cpf: "11122233344",
          cargo: "Separador",
          condutor: true,
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "MAT-9" }],
          emails: [{ endereco: "novo@empresa.com", principal: true }],
          telefones: [{ numero: "21988887777", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      expect(criado.pessoaFisica.nome).toBe("Novo Funcionário");
      const contatos = await prismaTeste.funcionarioTelefone.count({
        where: { id_funcionario: criado.id_funcionario },
      });
      expect(contatos).toBe(1);

      const auditoriasPf = await auditoriasDe("PessoaFisica", criado.id_pessoa_fisica);
      const auditoriasFunc = await auditoriasDe("Funcionario", criado.id_funcionario);
      expect(auditoriasPf.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasFunc.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditoriasFunc[0]?.dados_novos).toMatchObject({ condutor: true, cargo: "Separador" });
    });
  });

  describe("update", () => {
    it("altera dados, substitui listas e registra auditoria ALTERAR", async () => {
      const { usuario } = await criarUsuario();
      const { funcionario } = await criarUsuario({ nome: "Antigo Nome" });
      const tipo = await criarTipoCodigo("MATRICULA");

      await funcionarioDAO.update(
        funcionario.id_funcionario,
        {
          nome: "Novo Nome",
          cargo: "Conferente",
          condutor: true,
          ativo: true,
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "MAT-10" }],
          emails: [{ endereco: "novo@empresa.com", principal: false }],
          telefones: [{ numero: "21977776666", tipo: "CELULAR", principal: true }],
        },
        usuario.id_usuario,
      );

      const noBanco = await funcionarioDAO.getById(funcionario.id_funcionario);
      expect(noBanco?.pessoaFisica.nome).toBe("Novo Nome");
      expect(noBanco?.cargo).toBe("Conferente");
      expect(noBanco?.emails.map((e) => e.endereco)).toEqual(["novo@empresa.com"]);
      expect(noBanco?.telefones.map((t) => t.numero)).toEqual(["21977776666"]);

      const auditorias = await auditoriasDe("Funcionario", funcionario.id_funcionario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ nome: "Antigo Nome" });
      expect(auditorias[0]?.dados_novos).toMatchObject({ nome: "Novo Nome" });
    });

    it("registra DESATIVAR quando ativo vira false", async () => {
      const { usuario } = await criarUsuario();
      const { funcionario } = await criarUsuario();

      await funcionarioDAO.update(funcionario.id_funcionario, { ativo: false }, usuario.id_usuario);

      const auditorias = await auditoriasDe("Funcionario", funcionario.id_funcionario);
      expect(auditorias.map((a) => a.acao)).toEqual(["DESATIVAR"]);
    });

    it("bloqueia remover a marcação de condutor usado em remessa", async () => {
      const { usuario } = await criarUsuario();
      const { funcionario } = await criarFuncionario({ condutor: true });
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida();
      await criarRemessa({
        idNotaSaida: nota.id_nota_saida,
        idDestinatario: destinatario.id_destinatario,
        idCondutor: funcionario.id_funcionario,
      });

      await expect(
        funcionarioDAO.update(funcionario.id_funcionario, { condutor: false }, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
      const noBanco = await prismaTeste.funcionario.findUniqueOrThrow({
        where: { id_funcionario: funcionario.id_funcionario },
      });
      expect(noBanco.condutor).toBe(true);
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir funcionário sem vínculos", async () => {
      const { funcionario } = await criarUsuario({ nome: "Livre" });
      await prismaTeste.usuario.delete({ where: { id_funcionario: funcionario.id_funcionario } });

      const resultado = await funcionarioDAO.verificarRelacionamentos(funcionario.id_funcionario);

      expect(resultado.podeExcluir).toBe(true);
    });

    it("bloqueia quando há usuário, contagem ou remessa como condutor", async () => {
      const { usuario, funcionario } = await criarUsuario();
      const produto = await prismaTeste.produto.create({ data: { descricao: "P" } });
      const estoque = await prismaTeste.estoque.create({
        data: { id_produto: produto.id_produto, quantidade_atual: 0, data_entrada: new Date() },
      });
      const { item } = await criarInventarioComItem(estoque.id_estoque, usuario.id_usuario);
      await criarContagem(item.id_item_inventario, funcionario.id_funcionario, 0);
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida();
      await criarRemessa({
        idNotaSaida: nota.id_nota_saida,
        idDestinatario: destinatario.id_destinatario,
        idCondutor: funcionario.id_funcionario,
      });

      const resultado = await funcionarioDAO.verificarRelacionamentos(funcionario.id_funcionario);

      expect(resultado.podeExcluir).toBe(false);
      const texto = resultado.vinculos.join(" | ");
      expect(texto).toContain("usuário(s) vinculado(s)");
      expect(texto).toContain("contagem(ns) de inventário");
      expect(texto).toContain("remessa(s) como condutor");
    });
  });

  describe("hardDelete", () => {
    it("exclui funcionário e pessoa física e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const { funcionario, pessoaFisica } = await criarUsuario({ nome: "Excluir" });
      await prismaTeste.usuario.delete({ where: { id_funcionario: funcionario.id_funcionario } });

      await funcionarioDAO.hardDelete(funcionario.id_funcionario, usuario.id_usuario);

      expect(
        await prismaTeste.funcionario.findUnique({ where: { id_funcionario: funcionario.id_funcionario } }),
      ).toBeNull();
      expect(
        await prismaTeste.pessoaFisica.findUnique({ where: { id_pessoa_fisica: pessoaFisica.id_pessoa_fisica } }),
      ).toBeNull();

      const auditorias = await auditoriasDe("Funcionario", funcionario.id_funcionario);
      expect(auditorias.map((a) => a.acao)).toEqual(["EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há usuário vinculado", async () => {
      const { usuario } = await criarUsuario();
      const { funcionario } = await criarUsuario();

      await expect(
        funcionarioDAO.hardDelete(funcionario.id_funcionario, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
    });
  });
});
