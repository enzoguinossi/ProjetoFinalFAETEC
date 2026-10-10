import { describe, expect, it } from "vitest";
import { normalizaTelefones } from "@/lib/contatos";

describe("normalizaTelefones", () => {
  it("retorna lista vazia para undefined", () => {
    expect(normalizaTelefones(undefined)).toEqual([]);
  });

  it("remove máscara e mantém tipo válido", () => {
    expect(
      normalizaTelefones([
        { numero: "(21) 99999-8888", tipo: "CELULAR", principal: true },
      ]),
    ).toEqual([{ numero: "21999998888", tipo: "CELULAR", principal: true }]);
  });

  it("converte tipo desconhecido para CELULAR", () => {
    expect(
      normalizaTelefones([{ numero: "2133334444", tipo: "FAX", principal: false }]),
    ).toEqual([{ numero: "2133334444", tipo: "CELULAR", principal: false }]);
  });
});
