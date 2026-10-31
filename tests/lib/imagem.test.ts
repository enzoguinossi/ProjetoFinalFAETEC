import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { removerImagemAnexo, salvarImagemAnexo } from "@/lib/imagem";
import { UPLOADS_PUBLIC_DIR } from "@/lib/uploads";

describe("lib/imagem — segurança dos caminhos de anexo", () => {
  it("recusa pasta com traversal ou caminho absoluto", async () => {
    const buffer = Buffer.from("x");

    for (const pasta of [
      "../fora",
      "entregas/../../fora",
      "/etc",
      "C:\\Windows\\Temp",
    ]) {
      await expect(salvarImagemAnexo(pasta, buffer, "hash")).rejects.toThrow(
        "Pasta de anexo inválida.",
      );
    }
  });

  it("não remove arquivo fora de public/uploads", async () => {
    const fora = path.join(process.cwd(), "package.json");

    await removerImagemAnexo("/uploads/../../package.json");

    expect(existsSync(fora)).toBe(true);
  });

  it("grava e remove um arquivo dentro de public/uploads", async () => {
    const url = await salvarImagemAnexo(
      "testes-tmp/seguranca",
      Buffer.from("x"),
      "hash",
    );
    const absoluto = path.join(
      UPLOADS_PUBLIC_DIR,
      ...url.replace(/^\/uploads\//, "").split("/"),
    );

    expect(existsSync(absoluto)).toBe(true);
    await removerImagemAnexo(url);
    expect(existsSync(absoluto)).toBe(false);
  });
});
