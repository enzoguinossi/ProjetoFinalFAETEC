import { describe, expect, it } from "vitest";
import { campoVisivel } from "@/lib/filtros-barra";
import type { CampoVisivel } from "@/lib/filtros-barra";

const multi: CampoVisivel = { id: "tipo", tipo: "multi" };
const checkbox: CampoVisivel = { id: "condutor", tipo: "checkbox" };
const checkboxFixo: CampoVisivel = { id: "fotos", tipo: "checkbox", fixo: true };

describe("campoVisivel", () => {
  it("oculta multi e checkbox sem valor até serem adicionados", () => {
    expect(campoVisivel(multi, false, [])).toBe(false);
    expect(campoVisivel(checkbox, false, [])).toBe(false);
  });

  it("mostra o campo que tem valor ou foi adicionado", () => {
    expect(campoVisivel(multi, true, [])).toBe(true);
    expect(campoVisivel(checkbox, true, [])).toBe(true);
    expect(campoVisivel(multi, false, ["tipo"])).toBe(true);
    expect(campoVisivel(checkbox, false, ["condutor"])).toBe(true);
  });

  it("mantém o checkbox fixo sempre visível, mesmo sem valor ou adição", () => {
    expect(campoVisivel(checkboxFixo, false, [])).toBe(true);
    expect(campoVisivel(checkboxFixo, false, ["fotos"])).toBe(true);
  });
});
