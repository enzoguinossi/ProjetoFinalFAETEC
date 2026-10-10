import { describe, expect, it } from "vitest";
import { permissaoService } from "@/services/permissao";
import { criarPerfil, criarPermissao, criarUsuario } from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("permissaoService", () => {
  describe("listarTodas e listarTodasAgrupadas", () => {
    it("agrupa por prefixo e ignora permissões inativas", async () => {
      await criarPermissao("produto.listar");
      await criarPermissao("produto.criar");
      await criarPermissao("usuario.listar");
      await prismaTeste.permissao.create({ data: { nome: "produto.excluir", ativo: false } });

      const grupos = await permissaoService.listarTodasAgrupadas();

      const produto = grupos.find((g) => g.prefixo === "produto");
      expect(produto?.permissoes.map((p) => p.nome).sort()).toEqual([
        "produto.criar",
        "produto.listar",
      ]);
      expect(grupos.find((g) => g.prefixo === "usuario")?.permissoes).toHaveLength(1);
    });
  });

  describe("listarPorUsuario", () => {
    it("retorna os nomes das permissões do usuário", async () => {
      const { usuario } = await criarUsuario();
      const a = await criarPermissao("produto.listar");
      const b = await criarPermissao("produto.criar");
      await prismaTeste.usuarioPermissao.createMany({
        data: [
          { id_usuario: usuario.id_usuario, id_permissao: a.id_permissao },
          { id_usuario: usuario.id_usuario, id_permissao: b.id_permissao },
        ],
      });

      const nomes = await permissaoService.listarPorUsuario(usuario.id_usuario);

      expect(nomes.sort()).toEqual(["produto.criar", "produto.listar"]);
    });
  });

  describe("listarPerfisComPermissoes", () => {
    it("retorna perfis com suas permissões em uma consulta", async () => {
      const p1 = await criarPermissao("produto.listar");
      const p2 = await criarPermissao("produto.criar");
      await criarPerfil("Operador", [p1.id_permissao, p2.id_permissao]);
      await criarPerfil("Vazio");

      const perfis = await permissaoService.listarPerfisComPermissoes();

      expect(perfis.map((p) => p.nome)).toEqual(["Operador", "Vazio"]);
      expect(perfis[0]?.permissoes.sort()).toEqual(["produto.criar", "produto.listar"]);
      expect(perfis[1]?.permissoes).toEqual([]);
    });
  });

  describe("criarPerfil", () => {
    it("cria o perfil vinculando apenas permissões ativas existentes", async () => {
      const ativa = await criarPermissao("produto.listar");
      await prismaTeste.permissao.create({ data: { nome: "produto.criar", ativo: false } });

      const perfil = await permissaoService.criarPerfil({
        nome: "Novo Perfil",
        descricao: "desc",
        permissoes: ["produto.listar", "produto.criar", "inexistente.listar"],
      });

      const vinculos = await prismaTeste.perfilPermissao.findMany({
        where: { id_perfil: perfil.id_perfil },
      });
      expect(vinculos).toHaveLength(1);
      expect(vinculos[0]?.id_permissao).toBe(ativa.id_permissao);
    });
  });

  describe("alterarPerfil", () => {
    it("substitui as permissões quando informadas", async () => {
      const p1 = await criarPermissao("produto.listar");
      const p2 = await criarPermissao("usuario.listar");
      const perfil = await criarPerfil("Perfil", [p1.id_permissao]);

      await permissaoService.alterarPerfil(perfil.id_perfil, {
        nome: "Perfil Renomeado",
        permissoes: ["usuario.listar"],
      });

      const noBanco = await permissaoService.getPerfil(perfil.id_perfil);
      expect(noBanco?.nome).toBe("Perfil Renomeado");
      const vinculos = await prismaTeste.perfilPermissao.findMany({
        where: { id_perfil: perfil.id_perfil },
      });
      expect(vinculos.map((v) => v.id_permissao)).toEqual([p2.id_permissao]);
    });

    it("mantém as permissões quando não informadas", async () => {
      const p1 = await criarPermissao("produto.listar");
      const perfil = await criarPerfil("Perfil", [p1.id_permissao]);

      await permissaoService.alterarPerfil(perfil.id_perfil, { descricao: "nova desc" });

      const vinculos = await prismaTeste.perfilPermissao.findMany({
        where: { id_perfil: perfil.id_perfil },
      });
      expect(vinculos).toHaveLength(1);
    });
  });

  describe("salvarPermissoes", () => {
    it("substitui as permissões do usuário e registra auditoria", async () => {
      const { usuario: autor } = await criarUsuario();
      const { usuario: alvo } = await criarUsuario();
      const p1 = await criarPermissao("produto.listar");
      const p2 = await criarPermissao("produto.criar");
      await prismaTeste.usuarioPermissao.create({
        data: { id_usuario: alvo.id_usuario, id_permissao: p1.id_permissao },
      });

      await permissaoService.salvarPermissoes(
        alvo.id_usuario,
        ["produto.criar"],
        autor.id_usuario,
      );

      const vinculos = await prismaTeste.usuarioPermissao.findMany({
        where: { id_usuario: alvo.id_usuario },
      });
      expect(vinculos.map((v) => v.id_permissao)).toEqual([p2.id_permissao]);

      const auditorias = await auditoriasDe("UsuarioPermissao", alvo.id_usuario);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ permissoes: ["produto.listar"] });
      expect(auditorias[0]?.dados_novos).toMatchObject({ permissoes: ["produto.criar"] });
    });

    it("bloqueia alteração de permissões do super admin", async () => {
      const { usuario: admin } = await criarUsuario({ superAdmin: true });

      await expect(
        permissaoService.salvarPermissoes(admin.id_usuario, [], admin.id_usuario),
      ).rejects.toThrowError("Não é possível alterar permissões do Super Admin.");
    });
  });

  describe("excluirPerfil", () => {
    it("exclui o perfil, remove vínculos e registra auditoria EXCLUIR", async () => {
      const { usuario } = await criarUsuario();
      const p1 = await criarPermissao("produto.listar");
      const perfil = await criarPerfil("Descartável", [p1.id_permissao]);

      await permissaoService.excluirPerfil(perfil.id_perfil, usuario.id_usuario);

      expect(await permissaoService.getPerfil(perfil.id_perfil)).toBeNull();
      expect(
        await prismaTeste.perfilPermissao.count({ where: { id_perfil: perfil.id_perfil } }),
      ).toBe(0);

      const auditorias = await auditoriasDe("Perfil", perfil.id_perfil);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("EXCLUIR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({
        nome: "Descartável",
        permissoes: ["produto.listar"],
      });
    });
  });
});
