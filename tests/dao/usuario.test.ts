import { describe, expect, it } from "vitest";
import { usuarioDAO } from "@/dao/usuario";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarEstoque,
  criarFuncionario,
  criarMensagemMural,
  criarMovimentacao,
  criarPermissao,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("usuarioDAO", () => {
  describe("getById", () => {
    it("inclui funcionário com pessoa física e permissões", async () => {
      const { usuario } = await criarUsuario({ nome: "Alvo" });
      const permissao = await criarPermissao("produto.listar");
      await prismaTeste.usuarioPermissao.create({
        data: { id_usuario: usuario.id_usuario, id_permissao: permissao.id_permissao },
      });

      const encontrado = await usuarioDAO.getById(usuario.id_usuario);

      expect(encontrado?.funcionario.pessoaFisica.nome).toBe("Alvo");
      expect(encontrado?.permissoes).toHaveLength(1);
      expect(encontrado?.permissoes[0]?.permissao.nome).toBe("produto.listar");
    });

    it("retorna null quando não existe", async () => {
      expect(await usuarioDAO.getById(999999)).toBeNull();
    });
  });

  describe("getByLoginComFuncionario", () => {
    it("busca por login com funcionário e pessoa física", async () => {
      await criarUsuario({ login: "fulano", nome: "Fulano" });

      const encontrado = await usuarioDAO.getByLoginComFuncionario("fulano");

      expect(encontrado?.login).toBe("fulano");
      expect(encontrado?.funcionario.pessoaFisica.nome).toBe("Fulano");
    });

    it("retorna null para login inexistente", async () => {
      expect(await usuarioDAO.getByLoginComFuncionario("naoexiste")).toBeNull();
    });
  });

  describe("existeLogin", () => {
    it("detecta login existente e inexistente", async () => {
      await criarUsuario({ login: "ocupado" });

      expect(await usuarioDAO.existeLogin("ocupado")).not.toBeNull();
      expect(await usuarioDAO.existeLogin("livre")).toBeNull();
    });
  });

  describe("getAdmin", () => {
    it("retorna null quando não há super admin", async () => {
      await criarUsuario({ superAdmin: false });

      expect(await usuarioDAO.getAdmin()).toBeNull();
    });

    it("retorna o super admin existente", async () => {
      const { usuario } = await criarUsuario({ superAdmin: true });

      const admin = await usuarioDAO.getAdmin();

      expect(admin?.id_usuario).toBe(usuario.id_usuario);
    });
  });

  describe("list", () => {
    it("pagina, busca por login ou nome e ignora inativos", async () => {
      await criarUsuario({ login: "ana", nome: "Ana" });
      await criarUsuario({ login: "bruno", nome: "Bruno" });
      const inativo = await criarUsuario({ login: "inativo", nome: "Inativo" });
      await prismaTeste.usuario.update({
        where: { id_usuario: inativo.usuario.id_usuario },
        data: { ativo: false },
      });

      const todos = await usuarioDAO.list({ page: 1, limit: 2 });
      expect(todos.total).toBe(2);
      expect(todos.totalPages).toBe(1);

      const porLogin = await usuarioDAO.list({ search: "bruno" });
      expect(porLogin.total).toBe(1);
      expect(porLogin.data[0]?.login).toBe("bruno");

      const porNome = await usuarioDAO.list({ search: "Ana" });
      expect(porNome.total).toBe(1);
    });
  });

  describe("registrarAcesso", () => {
    it("atualiza o último acesso", async () => {
      const { usuario } = await criarUsuario();
      expect(usuario.ultimo_acesso).toBeNull();

      await usuarioDAO.registrarAcesso(usuario.id_usuario);

      const noBanco = await prismaTeste.usuario.findUniqueOrThrow({
        where: { id_usuario: usuario.id_usuario },
      });
      expect(noBanco.ultimo_acesso).toBeInstanceOf(Date);
    });
  });

  describe("criarSuperAdmin", () => {
    it("cria pessoa física, funcionário e usuário super admin com auditoria", async () => {
      const criado = await usuarioDAO.criarSuperAdmin({
        nome: "Admin",
        login: "admin",
        senha_hash: "hash",
      });

      expect(criado.super_admin).toBe(true);
      expect(criado.senha_alterada_em).toBeInstanceOf(Date);

      const funcionario = await prismaTeste.funcionario.findUniqueOrThrow({
        where: { id_funcionario: criado.id_funcionario },
        include: { pessoaFisica: true },
      });
      expect(funcionario.pessoaFisica.nome).toBe("Admin");

      const auditorias = await auditoriasDe("Usuario", criado.id_usuario);
      expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR"]);
      expect(auditorias[0]?.dados_novos).toMatchObject({ login: "admin", super_admin: true });
    });
  });

  describe("definirSenha", () => {
    it("grava a senha, atualiza timestamps e registra auditoria DEFINIR_SENHA", async () => {
      const { usuario } = await criarUsuario({ senhaHash: null, senhaAlteradaEm: null });
      const quando = new Date();
      quando.setMilliseconds(0);

      await usuarioDAO.definirSenha(usuario.id_usuario, "novo-hash", quando, usuario.id_usuario);

      const noBanco = await prismaTeste.usuario.findUniqueOrThrow({
        where: { id_usuario: usuario.id_usuario },
      });
      expect(noBanco.senha_hash).toBe("novo-hash");
      expect(noBanco.senha_alterada_em).toEqual(quando);
      expect(noBanco.ultimo_acesso).toEqual(quando);

      const auditorias = await auditoriasDe("Usuario", usuario.id_usuario);
      expect(auditorias.map((a) => a.acao)).toEqual(["DEFINIR_SENHA"]);
      expect(auditorias[0]?.dados_novos).toMatchObject({ senha_definida: true });
    });
  });

  describe("create", () => {
    it("cria usuário e registra auditoria CRIAR", async () => {
      const { usuario: autor } = await criarUsuario();
      const { funcionario } = await criarFuncionario();

      const criado = await usuarioDAO.create(
        { id_funcionario: funcionario.id_funcionario, login: "novo", senha_hash: null },
        autor.id_usuario,
      );

      expect(criado.login).toBe("novo");
      expect(criado.ativo).toBe(true);

      const auditorias = await auditoriasDe("Usuario", criado.id_usuario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.id_usuario).toBe(autor.id_usuario);
    });

    it("lança erro de unicidade para login duplicado", async () => {
      const { usuario: autor } = await criarUsuario();
      const { funcionario } = await criarFuncionario();
      await criarUsuario({ login: "duplicado" });

      await expect(
        usuarioDAO.create(
          { id_funcionario: funcionario.id_funcionario, login: "duplicado", senha_hash: null },
          autor.id_usuario,
        ),
      ).rejects.toMatchObject({ code: "P2002" });
    });
  });

  describe("update", () => {
    it("altera login/ativo e registra auditoria ALTERAR", async () => {
      const { usuario: autor } = await criarUsuario();
      const { usuario: alvo } = await criarUsuario({ login: "antigo" });

      await usuarioDAO.update(alvo.id_usuario, { login: "atualizado" }, autor.id_usuario);

      const noBanco = await prismaTeste.usuario.findUniqueOrThrow({
        where: { id_usuario: alvo.id_usuario },
      });
      expect(noBanco.login).toBe("atualizado");

      const auditorias = await auditoriasDe("Usuario", alvo.id_usuario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ login: "antigo" });
      expect(auditorias[0]?.dados_novos).toMatchObject({ login: "atualizado" });
    });

    it("registra DESATIVAR quando ativo vira false", async () => {
      const { usuario: autor } = await criarUsuario();
      const { usuario: alvo } = await criarUsuario();

      await usuarioDAO.update(alvo.id_usuario, { ativo: false }, autor.id_usuario);

      const auditorias = await auditoriasDe("Usuario", alvo.id_usuario);
      expect(auditorias.map((a) => a.acao)).toEqual(["DESATIVAR"]);
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir usuário sem vínculos", async () => {
      const { usuario: autor } = await criarUsuario();
      const { funcionario } = await criarFuncionario();
      const criado = await usuarioDAO.create(
        { id_funcionario: funcionario.id_funcionario, login: "limpo", senha_hash: null },
        autor.id_usuario,
      );

      const resultado = await usuarioDAO.verificarRelacionamentos(criado.id_usuario);

      expect(resultado.podeExcluir).toBe(true);
      expect(resultado.vinculos).toEqual([]);
    });

    it("bloqueia quando há movimentação, mensagem ou auditoria do usuário", async () => {
      const { usuario } = await criarUsuario();
      const produto = await criarProduto();
      const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 1 });
      await criarMovimentacao(estoque.id_estoque, usuario.id_usuario, 1);
      await criarMensagemMural(usuario.id_usuario);

      const resultado = await usuarioDAO.verificarRelacionamentos(usuario.id_usuario);

      expect(resultado.podeExcluir).toBe(false);
      const texto = resultado.vinculos.join(" | ");
      expect(texto).toContain("movimentação(ões)");
      expect(texto).toContain("mensagen(s) no mural");
    });
  });

  describe("hardDelete", () => {
    it("exclui usuário limpo, remove permissões e registra auditoria EXCLUIR", async () => {
      const { usuario: autor } = await criarUsuario();
      const { funcionario } = await criarFuncionario();
      const criado = await usuarioDAO.create(
        { id_funcionario: funcionario.id_funcionario, login: "descartavel", senha_hash: null },
        autor.id_usuario,
      );
      const permissao = await criarPermissao("produto.listar");
      await prismaTeste.usuarioPermissao.create({
        data: { id_usuario: criado.id_usuario, id_permissao: permissao.id_permissao },
      });

      await usuarioDAO.hardDelete(criado.id_usuario, autor.id_usuario);

      expect(
        await prismaTeste.usuario.findUnique({ where: { id_usuario: criado.id_usuario } }),
      ).toBeNull();
      expect(
        await prismaTeste.usuarioPermissao.count({ where: { id_usuario: criado.id_usuario } }),
      ).toBe(0);

      const auditorias = await auditoriasDe("Usuario", criado.id_usuario);
      expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há vínculos", async () => {
      const { usuario: autor } = await criarUsuario();
      const { usuario: alvo } = await criarUsuario();
      await criarMensagemMural(alvo.id_usuario);

      await expect(
        usuarioDAO.hardDelete(alvo.id_usuario, autor.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
    });
  });
});
