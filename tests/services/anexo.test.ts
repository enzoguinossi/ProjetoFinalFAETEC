import { describe, expect, it } from "vitest";
import { validarDonoUnico } from "@/dao/anexo";
import { anexoService } from "@/services/anexo";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";
import {
  criarFuncionario,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";

describe("anexoService", () => {
  it("rejeita zero ou mais de um dono", () => {
    expect(() => validarDonoUnico({})).toThrow(/exatamente um dono/i);
    expect(() =>
      validarDonoUnico({ id_produto: 1, id_funcionario: 2 }),
    ).toThrow(/exatamente um dono/i);
    expect(() =>
      validarDonoUnico({ id_produto: 1, id_expedicao_nota: 3 }),
    ).toThrow(/exatamente um dono/i);
    expect(validarDonoUnico({ id_funcionario: 5 })).toEqual({
      tipo: "funcionario",
      id: 5,
    });
  });

  it("cria os anexos do dono com auditoria e lista do mais recente", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const dono = { tipo: "produto" as const, id: produto.id_produto };

    const [primeiro] = await anexoService.criarAnexos(
      dono,
      [{ nome_arquivo: "a.webp", url: "/uploads/produtos/a.webp", tipo_mime: "image/webp" }],
      usuario.id_usuario,
    );
    const [segundo] = await anexoService.criarAnexos(
      dono,
      [{ nome_arquivo: "b.webp", url: "/uploads/produtos/b.webp", tipo_mime: "image/webp" }],
      usuario.id_usuario,
    );

    expect(primeiro?.id_anexo).toBeTruthy();
    expect(segundo?.id_anexo).toBeTruthy();

    const ativos = await anexoService.listarAtivos(dono);
    expect(ativos.map((anexo) => anexo.url)).toEqual([
      "/uploads/produtos/b.webp",
      "/uploads/produtos/a.webp",
    ]);
    expect((await anexoService.fotoAtual(dono))?.url).toBe("/uploads/produtos/b.webp");

    const auditorias = await auditoriasDe("Anexo", segundo!.id_anexo);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]!.acao).toBe("CRIAR");
    expect(auditorias[0]!.dados_novos).toMatchObject({
      url: "/uploads/produtos/b.webp",
      nome_arquivo: "b.webp",
      id_produto: produto.id_produto,
    });
  });

  it("substitui a foto: desativa a anterior e devolve a URL antiga", async () => {
    const { usuario } = await criarUsuario();
    const funcionario = await criarFuncionario();
    const dono = {
      tipo: "funcionario" as const,
      id: funcionario.funcionario.id_funcionario,
    };

    await anexoService.criarAnexos(
      dono,
      [{ nome_arquivo: "antiga.webp", url: "/uploads/funcionarios/antiga.webp" }],
      usuario.id_usuario,
    );

    const troca = await anexoService.substituirFoto(
      dono,
      { nome_arquivo: "nova.webp", url: "/uploads/funcionarios/nova.webp" },
      usuario.id_usuario,
    );

    expect(troca.urlsAntigas).toEqual(["/uploads/funcionarios/antiga.webp"]);
    expect((await anexoService.fotoAtual(dono))?.url).toBe(
      "/uploads/funcionarios/nova.webp",
    );

    const todas = await prismaTeste.anexo.findMany({
      where: { id_funcionario: dono.id },
      orderBy: { id_anexo: "asc" },
    });
    expect(todas).toHaveLength(2);
    expect(todas[0]!.ativo).toBe(false);
    expect(todas[1]!.ativo).toBe(true);

    const auditorias = await auditoriasDe("Anexo", todas[0]!.id_anexo);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "DESATIVAR"]);
  });

  it("desativa um anexo com soft delete e auditoria", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const [anexo] = await anexoService.criarAnexos(
      { tipo: "produto", id: produto.id_produto },
      [{ nome_arquivo: "foto.webp", url: "/uploads/produtos/foto.webp" }],
      usuario.id_usuario,
    );

    const desativado = await anexoService.desativar(anexo!.id_anexo, usuario.id_usuario);
    expect(desativado?.ativo).toBe(false);
    expect(await anexoService.fotoAtual({ tipo: "produto", id: produto.id_produto })).toBeNull();

    // Desativar novamente é idempotente (não duplica auditoria).
    expect(await anexoService.desativar(anexo!.id_anexo, usuario.id_usuario)).toBeNull();
    const auditorias = await auditoriasDe("Anexo", anexo!.id_anexo);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "DESATIVAR"]);
  });
});
