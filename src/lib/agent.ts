import "server-only";

/**
 * Cliente do NexusAgent — serviço local do Windows que executa backup e
 * restauração (ver `deploy/windows/NexusAgent`).
 *
 * - O agente escuta somente em loopback (`http://127.0.0.1:3215`).
 * - Toda chamada usa `Authorization: Bearer <AGENT_SECRET>`; o segredo vem de
 *   `process.env.AGENT_SECRET` (gravado pelo bootstrap) e nunca é devolvido nem
 *   registrado em log.
 * - Este módulo é `server-only`: não pode ser importado por componente client.
 *   O cliente importa apenas os tipos (`import type`), que são apagados no build.
 */

const TIMEOUT_MS = 10_000;
const URL_PADRAO = "http://127.0.0.1:3215";

export type AgentStepStatus = "pending" | "running" | "done" | "error";
export type AgentJobStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";
export type AgentJobType = "BACKUP" | "RESTORE";

export type AgentJobStep = {
  name: string;
  status: AgentStepStatus;
  message: string;
};

export type AgentJob = {
  id: string;
  type: AgentJobType;
  status: AgentJobStatus;
  percent: number;
  step: string;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: number | null;
  fileName: string | null;
  includeUploads: boolean;
  logPath: string | null;
  steps: AgentJobStep[];
};

export type AgentHealth = {
  status: string;
  version: string;
  mysql: string;
  agentDir: string;
};

export type AgentStatus = {
  current: AgentJob | null;
  last: AgentJob | null;
  schedule: AgentSchedule;
};

export type AgentBackupFile = {
  name: string;
  size: number;
  modifiedAt: string;
  /** Existe o snapshot de uploads do mesmo timestamp do dump. */
  hasUploads: boolean;
};

export type AgentSchedule = {
  enabled: boolean;
  time: string;
  weekdays: number[];
  retentionDays: number;
  includeUploads: boolean;
};

export type AgentFailure = {
  ok: false;
  error: string;
  status?: number;
  job?: AgentJob;
};

export type AgentResult<T> = { ok: true; data: T } | AgentFailure;

type OpcoesRequisicao = {
  metodo?: "GET" | "POST" | "PUT";
  corpo?: unknown;
};

/** URL base do agente; lida em tempo de chamada para permitir overrides. */
function urlDoAgente(): string {
  const url = (process.env.AGENT_URL ?? URL_PADRAO).trim();
  return (url || URL_PADRAO).replace(/\/+$/, "");
}

/** Segredo do agente; `null` quando ainda não foi configurado. */
function segredoDoAgente(): string | null {
  const segredo = process.env.AGENT_SECRET?.trim();
  return segredo ? segredo : null;
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

function mensagemDoCorpo(dados: unknown): string | null {
  if (!ehRegistro(dados)) return null;
  const erro = dados.error;
  return typeof erro === "string" && erro.trim() ? erro.trim() : null;
}

function jobDoCorpo(dados: unknown): AgentJob | undefined {
  if (!ehRegistro(dados)) return undefined;
  const job = dados.job;
  return ehRegistro(job) ? (job as unknown as AgentJob) : undefined;
}

/**
 * Executa uma chamada ao agente.
 *
 * Devolve `{ ok: true, data }` no sucesso e `{ ok: false, error, status?, job? }`
 * em 400/409/falha de rede. O segredo nunca compõe a mensagem de erro.
 */
async function chamar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<AgentResult<T>> {
  const segredo = segredoDoAgente();
  if (!segredo) {
    return { ok: false, error: "Agente indisponível: segredo não configurado." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const temCorpo = opcoes.corpo !== undefined;
    const resposta = await fetch(`${urlDoAgente()}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers: {
        Authorization: `Bearer ${segredo}`,
        Accept: "application/json",
        ...(temCorpo ? { "Content-Type": "application/json" } : {}),
      },
      body: temCorpo ? JSON.stringify(opcoes.corpo) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const dados = await lerJson(resposta);

    if (!resposta.ok) {
      return {
        ok: false,
        error:
          mensagemDoCorpo(dados) ??
          `O agente respondeu com status ${resposta.status}.`,
        status: resposta.status,
        job: jobDoCorpo(dados),
      };
    }

    return { ok: true, data: dados as T };
  } catch {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: `Agente indisponível: não respondeu em ${TIMEOUT_MS / 1000} segundos.`,
      };
    }
    return {
      ok: false,
      error: "Agente indisponível: não foi possível contatar o serviço local.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** `GET /v1/health` — status do agente e do serviço do MySQL. */
export function agentHealth(): Promise<AgentResult<AgentHealth>> {
  return chamar<AgentHealth>("/v1/health");
}

/** `GET /v1/status` — job atual, último concluído e agenda. */
export async function agentStatus(): Promise<AgentResult<AgentStatus>> {
  const resultado = await chamar<AgentStatus>("/v1/status");
  if (!resultado.ok) return resultado;

  const dados = resultado.data;
  if (!ehRegistro(dados) || !("current" in dados) || !("last" in dados)) {
    return {
      ok: false,
      error: "O agente respondeu em formato inesperado em /v1/status.",
    };
  }
  if (!ehRegistro(dados.schedule)) {
    return {
      ok: false,
      error: "O agente não informou a agenda em /v1/status.",
    };
  }
  return { ok: true, data: dados };
}

/** `GET /v1/jobs?limit=n` — histórico, do mais recente para o mais antigo. */
export async function agentJobs(limit = 50): Promise<AgentResult<AgentJob[]>> {
  const resultado = await chamar<{ jobs?: AgentJob[] }>(
    `/v1/jobs?limit=${encodeURIComponent(String(limit))}`,
  );
  if (!resultado.ok) return resultado;
  if (!ehRegistro(resultado.data) || !Array.isArray(resultado.data.jobs)) {
    return { ok: false, error: "O agente não devolveu a lista de jobs." };
  }
  return { ok: true, data: resultado.data.jobs };
}

/** `GET /v1/backups` — arquivos de backup disponíveis no manifesto. */
export async function agentBackups(): Promise<AgentResult<AgentBackupFile[]>> {
  const resultado = await chamar<{ files?: AgentBackupFile[] }>("/v1/backups");
  if (!resultado.ok) return resultado;
  if (!ehRegistro(resultado.data) || !Array.isArray(resultado.data.files)) {
    return { ok: false, error: "O agente não devolveu a lista de backups." };
  }

  // `hasUploads` ausente (agente antigo) conta como "sem uploads": a UI avisa e
  // desabilita a restauração de uploads em vez de prometer um snapshot inexistente.
  return {
    ok: true,
    data: resultado.data.files.map((arquivo) => ({
      ...arquivo,
      hasUploads: arquivo.hasUploads === true,
    })),
  };
}

/** `GET /v1/schedule` — agenda persistida no agente. */
export async function agentSchedule(): Promise<AgentResult<AgentSchedule>> {
  const resultado = await chamar<AgentSchedule>("/v1/schedule");
  if (!resultado.ok) return resultado;
  if (!ehRegistro(resultado.data) || !Array.isArray(resultado.data.weekdays)) {
    return { ok: false, error: "O agente respondeu em formato inesperado em /v1/schedule." };
  }
  return resultado;
}

/** `POST /v1/backup` — inicia um backup; 409 devolve o job ativo. */
export async function agentStartBackup(requestedBy: number): Promise<AgentResult<AgentJob>> {
  const resultado = await chamar<{ job?: AgentJob }>("/v1/backup", {
    metodo: "POST",
    corpo: { requestedBy },
  });
  if (!resultado.ok) return resultado;
  if (!resultado.data.job) {
    return { ok: false, error: "O agente não informou o job de backup." };
  }
  return { ok: true, data: resultado.data.job };
}

/** `POST /v1/restore` — inicia a restauração de um arquivo do manifesto. */
export async function agentStartRestore(
  fileName: string,
  includeUploads: boolean,
  requestedBy: number,
): Promise<AgentResult<AgentJob>> {
  const resultado = await chamar<{ job?: AgentJob }>("/v1/restore", {
    metodo: "POST",
    corpo: { fileName, includeUploads, requestedBy },
  });
  if (!resultado.ok) return resultado;
  if (!resultado.data.job) {
    return { ok: false, error: "O agente não informou o job de restauração." };
  }
  return { ok: true, data: resultado.data.job };
}

/** `PUT /v1/schedule` — grava a agenda; devolve a agenda normalizada. */
export async function agentSaveSchedule(agenda: AgentSchedule): Promise<AgentResult<AgentSchedule>> {
  const resultado = await chamar<AgentSchedule>("/v1/schedule", {
    metodo: "PUT",
    corpo: agenda,
  });
  if (!resultado.ok) return resultado;
  if (!ehRegistro(resultado.data) || !Array.isArray(resultado.data.weekdays)) {
    return { ok: false, error: "O agente respondeu em formato inesperado ao gravar a agenda." };
  }
  return resultado;
}
