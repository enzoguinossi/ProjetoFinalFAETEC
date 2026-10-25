import { describe, expect, it } from "vitest";
import { apenasDigitosCpf, formatarCpf, validarCpf } from "@/lib/cpf";

describe("lib/cpf", () => {
  it("aceita CPF válido e retorna apenas os dígitos", () => {
    expect(validarCpf("52998224725")).toEqual({ ok: true, cpf: "52998224725" });
  });

  it("aceita CPF válido formatado", () => {
    expect(validarCpf("529.982.247-25")).toEqual({ ok: true, cpf: "52998224725" });
  });

  it("recusa CPF com quantidade diferente de 11 dígitos", () => {
    expect(validarCpf("")).toMatchObject({ ok: false, erro: "Informe o CPF." });
    expect(validarCpf("5299822472")).toMatchObject({ ok: false });
    expect(validarCpf("529982247251")).toMatchObject({ ok: false });
  });

  it("recusa sequências repetidas", () => {
    expect(validarCpf("111.111.111-11")).toMatchObject({ ok: false, erro: "CPF inválido." });
    expect(validarCpf("00000000000")).toMatchObject({ ok: false });
  });

  it("recusa dígitos verificadores inválidos", () => {
    expect(validarCpf("52998224724")).toMatchObject({ ok: false, erro: "CPF inválido." });
  });

  it("remove caracteres não numéricos", () => {
    expect(apenasDigitosCpf("529.982.247-25")).toBe("52998224725");
  });

  it("formata progressivamente e limita a 11 dígitos", () => {
    expect(formatarCpf("")).toBe("");
    expect(formatarCpf("529")).toBe("529");
    expect(formatarCpf("5299")).toBe("529.9");
    expect(formatarCpf("529982")).toBe("529.982");
    expect(formatarCpf("5299822")).toBe("529.982.2");
    expect(formatarCpf("529982247")).toBe("529.982.247");
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarCpf("529.982.247-259999")).toBe("529.982.247-25");
  });
});
