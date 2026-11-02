import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

import { dynamic, GET, runtime } from "@/app/api/health/route";

const VERSAO = "0.0.0-teste";

describe("GET /api/health", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_VERSION = VERSAO;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    queryRaw.mockReset();
  });

  it("é dinâmica e usa o runtime Node (Prisma não roda no edge)", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(runtime).toBe("nodejs");
  });

  it("responde 200 e db=true quando o banco responde", async () => {
    queryRaw.mockResolvedValueOnce([{ "1": 1 }]);

    const resposta = await GET();

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({
      status: "ok",
      db: true,
      versao: VERSAO,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [sql] = queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(sql.join("")).toContain("SELECT 1");
  });

  it("responde 503 e db=false sem vazar o erro quando o banco falha", async () => {
    queryRaw.mockRejectedValueOnce(
      new Error("Access denied for user 'nexus'@'localhost' (using password: segredo)"),
    );

    const resposta = await GET();
    const corpo = await resposta.json();
    const serializado = JSON.stringify(corpo);

    expect(resposta.status).toBe(503);
    expect(corpo).toEqual({ status: "degraded", db: false, versao: VERSAO });
    expect(serializado).not.toContain("Access denied");
    expect(serializado).not.toContain("segredo");
  });
});
