import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "@/dao/_audit";
import { EntidadeComVinculosError, mensagemDeErro } from "@/dao/_errors";
import { criarUsuario } from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

function erroPrisma(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("erro simulado", {
    code,
    clientVersion: "7.9.1",
    meta,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registrarAuditoria", () => {
  it("grava snapshots anteriores e novos", async () => {
    const { usuario } = await criarUsuario();

    await registrarAuditoria(
      usuario.id_usuario,
      "ALTERAR",
      "EntidadeTeste",
      123,
      { campo: "antes" },
      { campo: "depois" },
    );

    const auditorias = await auditoriasDe("EntidadeTeste", 123);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      acao: "ALTERAR",
      entidade: "EntidadeTeste",
      id_usuario: usuario.id_usuario,
      dados_anteriores: { campo: "antes" },
      dados_novos: { campo: "depois" },
    });
    expect(auditorias[0]?.data_hora).toBeInstanceOf(Date);
  });

  it("grava null quando os snapshots não são informados", async () => {
    const { usuario } = await criarUsuario();

    await registrarAuditoria(usuario.id_usuario, "LOGIN", "Usuario", usuario.id_usuario);

    const auditorias = await auditoriasDe("Usuario", usuario.id_usuario);
    expect(auditorias[0]?.dados_anteriores).toBeNull();
    expect(auditorias[0]?.dados_novos).toBeNull();
  });

  it("participa de uma transação existente", async () => {
    const { usuario } = await criarUsuario();

    await expect(
      prismaTeste.$transaction(async (tx) => {
        await registrarAuditoria(
          usuario.id_usuario,
          "CRIAR",
          "EntidadeTeste",
          1,
          null,
          { ok: true },
          tx,
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(await prismaTeste.registroAuditoria.count()).toBe(0);
  });
});

describe("mensagemDeErro", () => {
  it("retorna a mensagem de EntidadeComVinculosError", () => {
    const erro = new EntidadeComVinculosError("este produto", ["2 registro(s) de estoque"]);
    expect(mensagemDeErro(erro)).toContain("2 registro(s) de estoque");
  });

  it("mapeia P2002 para mensagens por campo", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const casos: [unknown, string][] = [
      [["login"], "login"],
      [["cpf"], "CPF"],
      [["cnpj"], "CNPJ"],
      [["placa"], "placa"],
      [["codigo"], "código"],
      [["numero"], "telefone"],
      [["endereco"], "e-mail"],
      [["chave_acesso"], "chave de acesso"],
      [["nome"], "nome"],
      ["desconhecido", "registro"],
    ];

    for (const [target, trecho] of casos) {
      const mensagem = mensagemDeErro(erroPrisma("P2002", { target }));
      expect(mensagem.toLowerCase()).toContain(String(trecho).toLowerCase());
    }
  });

  it("mapeia P2003, P2025 e P2000", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensagemDeErro(erroPrisma("P2003"))).toContain("registros vinculados");
    expect(mensagemDeErro(erroPrisma("P2025"))).toContain("não encontrado");
    expect(mensagemDeErro(erroPrisma("P2000"))).toContain("muito longo");
  });

  it("usa o fallback para código desconhecido", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensagemDeErro(erroPrisma("P9999"), "Falha customizada")).toBe("Falha customizada");
  });

  it("retorna a mensagem de Error comum", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensagemDeErro(new Error("erro legível"))).toBe("erro legível");
  });

  it("usa o fallback para valores que não são Error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensagemDeErro("texto solto")).toBe("Erro ao salvar. Tente novamente.");
  });
});
