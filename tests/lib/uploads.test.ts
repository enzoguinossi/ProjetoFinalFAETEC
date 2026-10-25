import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolverCaminhoUpload, UPLOADS_PUBLIC_DIR } from "@/lib/uploads";

describe("lib/uploads", () => {
  it("resolve um caminho válido dentro de public/uploads", () => {
    expect(resolverCaminhoUpload(["produtos", "1", "foto.webp"])).toBe(
      path.join(UPLOADS_PUBLIC_DIR, "produtos", "1", "foto.webp"),
    );
  });

  it("recusa lista de segmentos vazia", () => {
    expect(resolverCaminhoUpload([])).toBeNull();
  });

  it("recusa traversal direto (`..`)", () => {
    expect(resolverCaminhoUpload([".."])).toBeNull();
    expect(resolverCaminhoUpload(["..", "..", "etc", "passwd"])).toBeNull();
  });

  it("recusa traversal no meio do caminho", () => {
    expect(resolverCaminhoUpload(["produtos", "../../x"])).toBeNull();
  });

  it("recusa caminho absoluto", () => {
    const absoluto = path.join(path.resolve(UPLOADS_PUBLIC_DIR, ".."), "fora.webp");
    expect(resolverCaminhoUpload([absoluto])).toBeNull();
  });

  it("mantém o caminho quando o `..` ainda permanece dentro da raiz", () => {
    expect(resolverCaminhoUpload(["produtos", "..", "produtos", "1", "foto.webp"])).toBe(
      path.join(UPLOADS_PUBLIC_DIR, "produtos", "1", "foto.webp"),
    );
  });
});
