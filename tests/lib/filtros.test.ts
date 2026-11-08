import { describe, expect, it } from "vitest";
import { textoFiltro } from "@/lib/filtros";

describe("textoFiltro", () => {
  it("aceita string e remove espaços das pontas", () => {
    expect(textoFiltro("  Escola Alfa ")).toBe("Escola Alfa");
    expect(textoFiltro("A")).toBe("A");
  });

  it("string vazia ou só espaços não filtram", () => {
    expect(textoFiltro("")).toBeUndefined();
    expect(textoFiltro("   ")).toBeUndefined();
  });

  it("ignora valores não-string (payload cru da Server Action)", () => {
    expect(textoFiltro(undefined)).toBeUndefined();
    expect(textoFiltro(null)).toBeUndefined();
    expect(textoFiltro(123)).toBeUndefined();
    expect(textoFiltro(["Escola"])).toBeUndefined();
    expect(textoFiltro({ termo: "Escola" })).toBeUndefined();
    expect(textoFiltro(true)).toBeUndefined();
  });
});
