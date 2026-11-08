import { describe, expect, it } from "vitest";
import { situacaoParaAtivo } from "@/lib/filtros-situacao";

describe("situacaoParaAtivo", () => {
  it("sem seleção devolve undefined (default do DAO: só ativos)", () => {
    expect(situacaoParaAtivo(undefined)).toBeUndefined();
    expect(situacaoParaAtivo([])).toBeUndefined();
    expect(situacaoParaAtivo({ de: "", ate: "" })).toBeUndefined();
  });

  it("só Ativos → true; só Inativos → false; ambos → null (todos)", () => {
    expect(situacaoParaAtivo(["ativo"])).toBe(true);
    expect(situacaoParaAtivo(["inativo"])).toBe(false);
    expect(situacaoParaAtivo(["ativo", "inativo"])).toBeNull();
    expect(situacaoParaAtivo(["inativo", "ativo"])).toBeNull();
  });
});
