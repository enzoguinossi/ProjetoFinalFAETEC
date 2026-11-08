import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const sessao = vi.hoisted(() => ({ id_usuario: 12 }));
const permissoes = vi.hoisted(() => ({ nomes: [] as string[] }));
const agente = vi.hoisted(() => ({
  agentStartBackup: vi.fn(),
  agentStartRestore: vi.fn(),
  agentSaveSchedule: vi.fn(),
  agentSchedule: vi.fn(),
}));
const auditoria = vi.hoisted(() => ({ registrarAuditoria: vi.fn() }));
const banco = vi.hoisted(() => ({ buscarUsuario: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    id_usuario: sessao.id_usuario,
    super_admin: false,
  }),
}));

vi.mock("@/services/permissao", () => ({
  permissaoService: {
    listarPorUsuario: async () => permissoes.nomes,
  },
}));

vi.mock("@/lib/agent", () => agente);

vi.mock("@/dao/_audit", () => auditoria);

vi.mock("@/lib/prisma", () => ({
  prisma: { usuario: { findUnique: banco.buscarUsuario } },
}));

import {
  iniciarBackup,
  iniciarRestauracao,
  salvarAgenda,
} from "@/app/administracao/backup/actions";

const job = {
  id: "job-1",
  type: "BACKUP" as const,
  status: "QUEUED" as const,
  percent: 0,
  step: "Pre-checagem",
  message: "",
  startedAt: null,
  finishedAt: null,
  requestedBy: sessao.id_usuario,
  fileName: null,
  includeUploads: true,
  logPath: null,
  steps: [],
};

const agendaAnterior = {
  enabled: true,
  time: "01:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  retentionDays: 30,
  includeUploads: true,
};

function formulario(campos: Record<string, string>) {
  const formData = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formData.set(campo, valor);
  return formData;
}

beforeEach(() => {
  permissoes.nomes = [];
  agente.agentStartBackup.mockReset();
  agente.agentStartRestore.mockReset();
  agente.agentSaveSchedule.mockReset();
  agente.agentSchedule.mockReset();
  auditoria.registrarAuditoria.mockReset();
  banco.buscarUsuario.mockReset();
});

describe("iniciarBackup", () => {
  it("sem backup.executar não chama o agente nem grava auditoria", async () => {
    permissoes.nomes = ["backup.listar"];

    const resultado = await iniciarBackup();

    expect(resultado).toEqual({ ok: false, error: "Sem permissão." });
    expect(agente.agentStartBackup).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("com permissão chama o agente e registra a solicitação", async () => {
    permissoes.nomes = ["backup.executar"];
    agente.agentStartBackup.mockResolvedValue({ ok: true, data: job });

    const resultado = await iniciarBackup();

    expect(resultado).toEqual({ ok: true, job });
    expect(agente.agentStartBackup).toHaveBeenCalledWith(sessao.id_usuario);
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      sessao.id_usuario,
      "SOLICITAR_BACKUP",
      "backup",
      null,
      null,
      { origem: "aplicacao" },
    );
  });

  it("devolve erro do agente sem lançar exceção e sem auditar", async () => {
    permissoes.nomes = ["backup.executar"];
    agente.agentStartBackup.mockResolvedValue({
      ok: false,
      error: "Já existe um job em execução.",
    });

    const resultado = await iniciarBackup();

    expect(resultado).toEqual({ ok: false, error: "Já existe um job em execução." });
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("converte exceção inesperada em resultado com erro", async () => {
    permissoes.nomes = ["backup.executar"];
    agente.agentStartBackup.mockRejectedValue(new Error("ECONNRESET"));

    const resultado = await iniciarBackup();

    expect(resultado).toEqual({
      ok: false,
      error: "Não foi possível iniciar o backup. Tente novamente.",
    });
  });
});

describe("salvarAgenda", () => {
  const agendasInvalidas: Array<[string, { time?: string; weekdays?: number[]; retentionDays?: number }]> = [
    ["horário fora de HH:mm", { time: "25:00" }],
    ["sem nenhum dia", { weekdays: [] }],
    ["dia fora de 0–6", { weekdays: [1, 7] }],
    ["retenção fora de 1–365", { retentionDays: 0 }],
  ];

  it.each(agendasInvalidas)("recusa agenda inválida (%s) sem chamar o agente", async (_caso, alteracao) => {
    permissoes.nomes = ["backup.agendar"];

    const resultado = await salvarAgenda({
      enabled: true,
      time: "02:00",
      weekdays: [1, 2, 3],
      retentionDays: 30,
      includeUploads: true,
      ...alteracao,
    });

    expect(resultado.ok).toBe(false);
    expect(agente.agentSaveSchedule).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("grava a agenda válida no agente e audita depois do aceite", async () => {
    permissoes.nomes = ["backup.agendar"];
    agente.agentSchedule.mockResolvedValue({ ok: true, data: agendaAnterior });
    agente.agentSaveSchedule.mockImplementation(async (agenda) => ({ ok: true, data: agenda }));

    const entrada = {
      enabled: true,
      time: "02:30",
      weekdays: [3, 1],
      retentionDays: 45,
      includeUploads: false,
    };
    const esperada = { ...entrada, weekdays: [1, 3] };

    const resultado = await salvarAgenda(entrada);

    expect(resultado).toEqual({ ok: true, agenda: esperada });
    expect(agente.agentSaveSchedule).toHaveBeenCalledWith(esperada);
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      sessao.id_usuario,
      "ALTERAR_AGENDA",
      "backup",
      null,
      agendaAnterior,
      esperada,
    );
  });

  it("não audita quando o agente recusa a agenda", async () => {
    permissoes.nomes = ["backup.agendar"];
    agente.agentSchedule.mockResolvedValue({ ok: true, data: agendaAnterior });
    agente.agentSaveSchedule.mockResolvedValue({ ok: false, error: "Agenda recusada." });

    const resultado = await salvarAgenda({
      enabled: true,
      time: "02:00",
      weekdays: [1],
      retentionDays: 30,
      includeUploads: true,
    });

    expect(resultado).toEqual({ ok: false, error: "Agenda recusada." });
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });
});

describe("iniciarRestauracao", () => {
  const arquivo = "nexus_prod-20261108-020000.zip";
  let senhaHash: string;

  beforeEach(async () => {
    permissoes.nomes = ["backup.restaurar"];
    senhaHash = await bcrypt.hash("senha-correta", 4);
    banco.buscarUsuario.mockResolvedValue({ senha_hash: senhaHash });
  });

  it("recusa confirmação diferente de RESTAURAR", async () => {
    const resultado = await iniciarRestauracao(
      formulario({
        fileName: arquivo,
        includeUploads: "true",
        confirmacao: "APAGAR",
        senha: "senha-correta",
      }),
    );

    expect(resultado.ok).toBe(false);
    expect(agente.agentStartRestore).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("recusa quando a senha não foi informada", async () => {
    const resultado = await iniciarRestauracao(
      formulario({ fileName: arquivo, includeUploads: "true", confirmacao: "RESTAURAR" }),
    );

    expect(resultado).toEqual({ ok: false, error: "Informe a sua senha para continuar." });
    expect(agente.agentStartRestore).not.toHaveBeenCalled();
  });

  it("recusa senha incorreta sem chamar o agente", async () => {
    const resultado = await iniciarRestauracao(
      formulario({
        fileName: arquivo,
        includeUploads: "true",
        confirmacao: "RESTAURAR",
        senha: "senha-errada",
      }),
    );

    expect(resultado).toEqual({ ok: false, error: "Senha incorreta." });
    expect(agente.agentStartRestore).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it("aceita RESTAURAR em minúsculas + senha válida e inicia o job", async () => {
    agente.agentStartRestore.mockResolvedValue({
      ok: true,
      data: { ...job, type: "RESTORE", status: "RUNNING", fileName: arquivo },
    });

    const resultado = await iniciarRestauracao(
      formulario({
        fileName: arquivo,
        includeUploads: "true",
        confirmacao: "restaurar",
        senha: "senha-correta",
      }),
    );

    expect(resultado.ok).toBe(true);
    expect(agente.agentStartRestore).toHaveBeenCalledWith(arquivo, true, sessao.id_usuario);
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      sessao.id_usuario,
      "RESTAURAR",
      "backup",
      null,
      null,
      { fileName: arquivo, includeUploads: true },
    );
  });
});
