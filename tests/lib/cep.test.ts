import { describe, expect, it } from "vitest";
import { CEP_MAX_CARACTERES, formatarCep, validarCep } from "@/lib/cep";

describe("formatarCep", () => {
  it("aplica a máscara 00000-000", () => {
    expect(formatarCep("21735180")).toBe("21735-180");
    expect(formatarCep("21735-180")).toBe("21735-180");
  });

  it("tolera entrada parcial e limita a 8 dígitos", () => {
    expect(formatarCep("")).toBe("");
    expect(formatarCep("21735")).toBe("21735");
    expect(formatarCep("217351801234")).toBe("21735-180");
    expect(CEP_MAX_CARACTERES).toBe(9);
  });
});

describe("validarCep", () => {
  it("aceita 8 dígitos com ou sem máscara", () => {
    expect(validarCep("21735180")).toEqual({ ok: true, cep: "21735180" });
    expect(validarCep("21735-180")).toEqual({ ok: true, cep: "21735180" });
  });

  it("recusa vazio ou incompleto", () => {
    expect(validarCep("")).toEqual({
      ok: false,
      erro: "CEP deve conter 8 dígitos.",
    });
    expect(validarCep("2173518")).toEqual({
      ok: false,
      erro: "CEP deve conter 8 dígitos.",
    });
  });
});
