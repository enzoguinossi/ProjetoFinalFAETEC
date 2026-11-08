"use server";

import bcrypt from "bcryptjs";
import { registrarAuditoria } from "@/dao/_audit";
import { prisma } from "@/lib/prisma";
import {
  agentSaveSchedule,
  agentSchedule,
  agentStartBackup,
  agentStartRestore,
  type AgentJob,
  type AgentSchedule,
} from "@/lib/agent";
import { comPermissao } from "@/lib/permissoes";

export type AgendaBackupInput = {
  enabled: boolean;
  time: string;
  weekdays: number[];
  retentionDays: number;
  includeUploads: boolean;
};

export type ResultadoBackup =
  | { ok: true; job: AgentJob }
  | { ok: false; error: string };

export type ResultadoAgenda =
  | { ok: true; agenda: AgentSchedule }
  | { ok: false; error: string };

export type ResultadoRestauracao =
  | { ok: true; job: AgentJob }
  | { ok: false; error: string };

function falha(error: string) {
  return { ok: false as const, error };
}

const ERRO_BACKUP = "Não foi possível iniciar o backup. Tente novamente.";
const ERRO_AGENDA = "Não foi possível salvar a agenda. Tente novamente.";
const ERRO_RESTAURACAO = "Não foi possível iniciar a restauração. Tente novamente.";

/** Valida a agenda antes de chamar o agente (mesmas regras do `ScheduleStore`). */
function validarAgenda(input: AgendaBackupInput): string | null {
  if (typeof input !== "object" || input === null) return "Agenda inválida.";

  if (typeof input.enabled !== "boolean") {
    return "Informe se a agenda está ativa.";
  }

  if (typeof input.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    return "Horário inválido; use HH:mm.";
  }

  if (!Array.isArray(input.weekdays) || input.weekdays.length === 0) {
    return "Selecione ao menos um dia da semana.";
  }

  if (input.weekdays.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    return "Dias da semana devem estar entre 0 (domingo) e 6 (sábado).";
  }

  if (new Set(input.weekdays).size !== input.weekdays.length) {
    return "Dias da semana não podem se repetir.";
  }

  if (
    !Number.isInteger(input.retentionDays) ||
    input.retentionDays < 1 ||
    input.retentionDays > 365
  ) {
    return "A retenção deve ficar entre 1 e 365 dias.";
  }

  if (typeof input.includeUploads !== "boolean") {
    return "Informe se os uploads entram no backup.";
  }

  return null;
}

/** Inicia um backup manual e registra a solicitação na auditoria. */
export async function iniciarBackup(): Promise<ResultadoBackup> {
  try {
    const resultado = await comPermissao("backup.executar", async (user) => {
      const inicio = await agentStartBackup(user.id_usuario);
      if (!inicio.ok) return falha(inicio.error);

      // Auditoria só depois do aceite (202): uma falha do agente não pode
      // ficar registrada como se o backup tivesse sido solicitado.
      await registrarAuditoria(
        user.id_usuario,
        "SOLICITAR_BACKUP",
        "backup",
        null,
        null,
        { origem: "aplicacao" },
      );

      return { ok: true as const, job: inicio.data };
    });

    if ("error" in resultado) return falha(resultado.error);
    return resultado;
  } catch {
    return falha(ERRO_BACKUP);
  }
}

/** Grava a agenda no agente e registra antes/depois na auditoria. */
export async function salvarAgenda(input: AgendaBackupInput): Promise<ResultadoAgenda> {
  try {
    const resultado = await comPermissao("backup.agendar", async (user) => {
      const erro = validarAgenda(input);
      if (erro) return falha(erro);

      const agenda: AgentSchedule = {
        enabled: input.enabled,
        time: input.time,
        weekdays: [...input.weekdays].sort((a, b) => a - b),
        retentionDays: input.retentionDays,
        includeUploads: input.includeUploads,
      };

      const anterior = await agentSchedule();

      const gravada = await agentSaveSchedule(agenda);
      if (!gravada.ok) return falha(gravada.error);

      // Auditoria depois do aceite (200): se o agente recusou, nada mudou.
      await registrarAuditoria(
        user.id_usuario,
        "ALTERAR_AGENDA",
        "backup",
        null,
        anterior.ok ? anterior.data : null,
        gravada.data,
      );

      return { ok: true as const, agenda: gravada.data };
    });

    if ("error" in resultado) return falha(resultado.error);
    return resultado;
  } catch {
    return falha(ERRO_AGENDA);
  }
}

function lerBooleano(formData: FormData, campo: string, padrao: boolean): boolean {
  const bruto = formData.get(campo);
  if (bruto === null) return padrao;
  const valor = String(bruto).trim().toLowerCase();
  return valor === "true" || valor === "on" || valor === "1";
}

/**
 * Inicia a restauração. Exige a confirmação digitada `RESTAURAR` e a senha do
 * próprio usuário — a operação substitui banco e uploads e derruba a aplicação.
 * A auditoria é gravada antes de chamar o agente, porque a aplicação pode
 * encerrar durante a restauração.
 */
export async function iniciarRestauracao(formData: FormData): Promise<ResultadoRestauracao> {
  try {
    const resultado = await comPermissao("backup.restaurar", async (user) => {
      const fileName = String(formData.get("fileName") ?? "").trim();
      const confirmacao = String(formData.get("confirmacao") ?? "").trim();
      const senha = String(formData.get("senha") ?? "");
      const includeUploads = lerBooleano(formData, "includeUploads", true);

      if (!fileName) return falha("Selecione o backup que será restaurado.");
      if (confirmacao.toUpperCase() !== "RESTAURAR") {
        return falha("Digite RESTAURAR para confirmar a operação.");
      }
      if (!senha) return falha("Informe a sua senha para continuar.");

      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario: user.id_usuario },
        select: { senha_hash: true },
      });

      if (!usuario?.senha_hash) return falha("Senha incorreta.");
      if (!(await bcrypt.compare(senha, usuario.senha_hash))) {
        return falha("Senha incorreta.");
      }

      await registrarAuditoria(
        user.id_usuario,
        "RESTAURAR",
        "backup",
        null,
        null,
        { fileName, includeUploads },
      );

      const inicio = await agentStartRestore(fileName, includeUploads, user.id_usuario);
      if (!inicio.ok) return falha(inicio.error);

      return { ok: true as const, job: inicio.data };
    });

    if ("error" in resultado) return falha(resultado.error);
    return resultado;
  } catch {
    return falha(ERRO_RESTAURACAO);
  }
}
