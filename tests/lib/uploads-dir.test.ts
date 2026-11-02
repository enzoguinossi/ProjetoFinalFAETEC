import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const raizTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-uploads-"));
const uploadsDirOriginal = process.env.UPLOADS_DIR;

afterEach(() => {
  if (uploadsDirOriginal === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = uploadsDirOriginal;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(raizTemporaria, { recursive: true, force: true });
});

describe("lib/uploads com UPLOADS_DIR", () => {
  it("usa UPLOADS_DIR como raiz física dos uploads", async () => {
    process.env.UPLOADS_DIR = raizTemporaria;
    vi.resetModules();

    const { UPLOADS_PUBLIC_DIR, resolverCaminhoUpload } = await import("@/lib/uploads");
    const esperado = path.join(path.resolve(raizTemporaria), "a", "b.webp");

    expect(UPLOADS_PUBLIC_DIR).toBe(path.resolve(raizTemporaria));
    expect(resolverCaminhoUpload(["a", "b.webp"])).toBe(esperado);
  });

  it("continua recusando traversal a partir da raiz configurada", async () => {
    process.env.UPLOADS_DIR = raizTemporaria;
    vi.resetModules();

    const { resolverCaminhoUpload } = await import("@/lib/uploads");

    expect(resolverCaminhoUpload(["..", "x"])).toBeNull();
    expect(resolverCaminhoUpload(["a", "../../x"])).toBeNull();
  });

  it("aceita caminho relativo ao cwd", async () => {
    process.env.UPLOADS_DIR = "uploads-teste";
    vi.resetModules();

    const { UPLOADS_PUBLIC_DIR } = await import("@/lib/uploads");

    expect(UPLOADS_PUBLIC_DIR).toBe(path.resolve("uploads-teste"));
  });

  it("sem UPLOADS_DIR mantém public/uploads", async () => {
    delete process.env.UPLOADS_DIR;
    vi.resetModules();

    const { UPLOADS_PUBLIC_DIR, resolverCaminhoUpload } = await import("@/lib/uploads");
    const raizPadrao = path.join(process.cwd(), "public", "uploads");

    expect(UPLOADS_PUBLIC_DIR).toBe(raizPadrao);
    expect(resolverCaminhoUpload(["a", "b.webp"])).toBe(path.join(raizPadrao, "a", "b.webp"));
  });
});
