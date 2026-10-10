import { describe, expect, it } from "vitest";
import {
  apenasDigitosTelefone,
  formatarTelefone,
  validarTelefone,
  TIPO_TELEFONE_LABEL,
} from "@/lib/telefone";
import { normalizarEmail, validarEmail } from "@/lib/email";
import { tipoPermitido, tiposPermitidosPara, validarCodigo } from "@/lib/codigo";
import { buildPagination, resultadoVazio } from "@/types";
import { isUF } from "@/lib/uf";
import { formatarCodigo } from "@/lib/formatar";

describe("lib/telefone", () => {
  it("formata progressivamente com DDD", () => {
    expect(formatarTelefone("21")).toBe("(21");
    expect(formatarTelefone("2199")).toBe("(21) 99");
    expect(formatarTelefone("219999")).toBe("(21) 9999");
    expect(formatarTelefone("21999998888")).toBe("(21) 99999-8888");
    expect(formatarTelefone("2133334444")).toBe("(21) 3333-4444");
  });

  it("remove caracteres não numéricos", () => {
    expect(apenasDigitosTelefone("(21) 99999-8888")).toBe("21999998888");
  });

  it("valida telefone brasileiro com DDD", () => {
    expect(validarTelefone("")).toMatchObject({ ok: false });
    expect(validarTelefone("219999")).toMatchObject({ ok: false });
    expect(validarTelefone("01999998888")).toMatchObject({ ok: false, erro: "DDD inválido." });
    expect(validarTelefone("(21) 3333-4444")).toEqual({ ok: true, numero: "2133334444" });
    expect(validarTelefone("21999998888")).toEqual({ ok: true, numero: "21999998888" });
  });

  it("possui rótulos para todos os tipos", () => {
    expect(Object.keys(TIPO_TELEFONE_LABEL).sort()).toEqual(["CELULAR", "COMERCIAL", "FIXO"]);
  });
});

describe("lib/email", () => {
  it("normaliza com trim", () => {
    expect(normalizarEmail("  a@b.com ")).toBe("a@b.com");
  });

  it("valida formato de e-mail", () => {
    expect(validarEmail("")).toMatchObject({ ok: false });
    expect(validarEmail("invalido")).toMatchObject({ ok: false });
    expect(validarEmail("a@b")).toMatchObject({ ok: false });
    expect(validarEmail(" a@b.com ")).toEqual({ ok: true, endereco: "a@b.com" });
  });
});

describe("lib/codigo", () => {
  it("valida EAN12/EAN13 com quantidade exata de dígitos", () => {
    expect(validarCodigo("EAN12", "123456789012")).toEqual({ ok: true, valor: "123456789012" });
    expect(validarCodigo("EAN12", "123")).toMatchObject({ ok: false });
    expect(validarCodigo("EAN13", "1234567890123")).toEqual({ ok: true, valor: "1234567890123" });
    expect(validarCodigo("EAN13", "12345678901a3")).toMatchObject({ ok: false });
  });

  it("valida texto livre com trim e obrigatoriedade", () => {
    expect(validarCodigo("DIGITACAO", "  ABC  ")).toEqual({ ok: true, valor: "ABC" });
    expect(validarCodigo("DIGITACAO", "   ")).toMatchObject({ ok: false });
  });

  it("controla tipos permitidos por entidade", () => {
    expect(tiposPermitidosPara("PRODUTO")).toContain("EAN13");
    expect(tipoPermitido("PRODUTO", "EAN13")).toBe(true);
    expect(tipoPermitido("PRODUTO", "MATRICULA")).toBe(false);
    expect(tipoPermitido("FUNCIONARIO", "MATRICULA")).toBe(true);
  });
});

describe("types/buildPagination", () => {
  it("aplica padrões e limites", () => {
    expect(buildPagination({})).toEqual({ skip: 0, take: 20 });
    expect(buildPagination({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
    expect(buildPagination({ page: 0, limit: 0 })).toEqual({ skip: 0, take: 1 });
    expect(buildPagination({ limit: 999 })).toEqual({ skip: 0, take: 100 });
  });

  it("resultadoVazio devolve shape paginado coerente", () => {
    expect(resultadoVazio({ page: 2, limit: 5 })).toEqual({
      data: [],
      total: 0,
      page: 2,
      limit: 5,
      totalPages: 0,
    });
  });
});

describe("lib/uf e lib/formatar", () => {
  it("isUF aceita apenas siglas válidas", () => {
    expect(isUF("RJ")).toBe(true);
    expect(isUF("rj")).toBe(false);
    expect(isUF("XX")).toBe(false);
  });

  it("formatarCodigo preenche com zeros à esquerda", () => {
    expect(formatarCodigo(7)).toBe("000007");
    expect(formatarCodigo(1234567)).toBe("1234567");
  });
});
