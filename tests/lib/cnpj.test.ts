import { describe, expect, it } from "vitest";
import { apenasDigitosCnpj, formatarCnpj, validarCnpj } from "@/lib/cnpj";

describe("lib/cnpj", () => {
  it("aceita CNPJ válido e retorna apenas os dígitos", () => {
    expect(validarCnpj("11222333000181")).toEqual({ ok: true, cnpj: "11222333000181" });
  });

  it("aceita CNPJ válido formatado", () => {
    expect(validarCnpj("11.222.333/0001-81")).toEqual({ ok: true, cnpj: "11222333000181" });
  });

  it("recusa CNPJ com quantidade diferente de 14 dígitos", () => {
    expect(validarCnpj("")).toMatchObject({ ok: false, erro: "Informe o CNPJ." });
    expect(validarCnpj("1122233300018")).toMatchObject({ ok: false });
    expect(validarCnpj("112223330001811")).toMatchObject({ ok: false });
  });

  it("recusa sequências repetidas", () => {
    expect(validarCnpj("11.111.111/1111-11")).toMatchObject({ ok: false, erro: "CNPJ inválido." });
    expect(validarCnpj("00000000000000")).toMatchObject({ ok: false });
  });

  it("recusa dígitos verificadores inválidos", () => {
    expect(validarCnpj("11222333000182")).toMatchObject({ ok: false, erro: "CNPJ inválido." });
  });

  it("remove caracteres não numéricos", () => {
    expect(apenasDigitosCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("formata progressivamente e limita a 14 dígitos", () => {
    expect(formatarCnpj("")).toBe("");
    expect(formatarCnpj("1")).toBe("1");
    expect(formatarCnpj("112")).toBe("11.2");
    expect(formatarCnpj("11222")).toBe("11.222");
    expect(formatarCnpj("11222333")).toBe("11.222.333");
    expect(formatarCnpj("112223330")).toBe("11.222.333/0");
    expect(formatarCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("11.222.333/0001-8199")).toBe("11.222.333/0001-81");
  });
});
