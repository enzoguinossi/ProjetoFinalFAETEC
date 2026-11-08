import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentBackups,
  agentHealth,
  agentJobs,
  agentStartBackup,
  agentStartRestore,
  agentStatus,
} from "@/lib/agent";

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const job = {
  id: "job-1",
  type: "BACKUP",
  status: "QUEUED",
  percent: 0,
  step: "Pre-checagem",
  message: "",
  startedAt: null,
  finishedAt: null,
  requestedBy: 7,
  fileName: null,
  includeUploads: true,
  logPath: null,
  steps: [],
};

describe("cliente do NexusAgent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AGENT_URL", "http://127.0.0.1:3215");
    vi.stubEnv("AGENT_SECRET", "segredo-de-teste");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("envia o token no header e devolve o corpo em 200", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta({ status: "ok", version: "1.0.0", mysql: "Running", agentDir: "C:\\Nexus" }),
    );

    const resultado = await agentHealth();

    expect(resultado).toEqual({
      ok: true,
      data: { status: "ok", version: "1.0.0", mysql: "Running", agentDir: "C:\\Nexus" },
    });

    const [url, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3215/v1/health");
    expect(opcoes.cache).toBe("no-store");
    const headers = opcoes.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer segredo-de-teste");
    expect(JSON.stringify(resultado)).not.toContain("segredo-de-teste");
  });

  it("interpreta 400 de validação como erro do agente", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta({ error: "fileName é obrigatório." }, 400),
    );

    const resultado = await agentStartRestore("", true, 7);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe("fileName é obrigatório.");
      expect(resultado.status).toBe(400);
      expect(resultado.job).toBeUndefined();
    }
  });

  it("interpreta 409 (job ativo) devolvendo o job em andamento", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta({ error: "Já existe um job em execução.", job }, 409),
    );

    const resultado = await agentStartBackup(7);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.status).toBe(409);
      expect(resultado.error).toBe("Já existe um job em execução.");
      expect(resultado.job?.id).toBe("job-1");
    }
  });

  it("devolve erro claro quando o agente está fora do ar, sem vazar o segredo", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const resultado = await agentStatus();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("Agente indisponível");
      expect(resultado.error).not.toContain("segredo-de-teste");
    }
  });

  it("não chama o agente quando o segredo não está configurado", async () => {
    vi.stubEnv("AGENT_SECRET", "");

    const resultado = await agentStartBackup(1);

    expect(resultado).toEqual({
      ok: false,
      error: "Agente indisponível: segredo não configurado.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa 200 sem current/last em /v1/status", async () => {
    fetchMock.mockResolvedValueOnce(resposta({ schedule: { time: "02:00" } }));

    const resultado = await agentStatus();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("formato inesperado");
    }
  });

  it("recusa 200 sem a lista de jobs", async () => {
    fetchMock.mockResolvedValueOnce(resposta({ total: 0 }));

    const resultado = await agentJobs();

    expect(resultado).toEqual({ ok: false, error: "O agente não devolveu a lista de jobs." });
  });

  it("normaliza hasUploads do manifesto (ausente = false)", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta({
        files: [
          { name: "nexus_prod-20260101-000000.zip", size: 10, modifiedAt: "", hasUploads: true },
          { name: "nexus_prod-20260102-000000.zip", size: 20, modifiedAt: "" },
        ],
      }),
    );

    const resultado = await agentBackups();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.map((arquivo) => arquivo.hasUploads)).toEqual([true, false]);
    }
  });
});
