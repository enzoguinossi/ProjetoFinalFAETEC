"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Circle,
  CircleCheck,
  CircleX,
  Clock,
  Database,
  HardDrive,
  LoaderCircle,
  Play,
  RotateCcw,
  Server,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import Button from "@/components/Button";
import DataTable, { type Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { useAviso } from "@/components/AvisoProvider";
import type {
  AgentBackupFile,
  AgentHealth,
  AgentJob,
  AgentJobStatus,
  AgentSchedule,
  AgentStatus,
  AgentStepStatus,
} from "@/lib/agent";
import {
  iniciarBackup,
  iniciarRestauracao,
  salvarAgenda,
} from "./actions";

interface BackupClientProps {
  online: boolean;
  erroAgente: string | null;
  agoraISO: string;
  health: AgentHealth | null;
  status: AgentStatus | null;
  jobs: AgentJob[] | null;
  backups: AgentBackupFile[] | null;
  schedule: AgentSchedule | null;
  podeExecutar: boolean;
  podeAgendar: boolean;
  podeRestaurar: boolean;
}

type RespostaStatus = {
  agentOnline: boolean;
  status?: AgentStatus;
  error?: string;
};

type LinhaJob = {
  id: string;
  tipo: string;
  status: AgentJobStatus;
  origem: string;
  inicio: string;
  duracao: string;
  arquivo: string;
  mensagem: string;
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const campoCls =
  "h-10 w-full rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-ink outline-none transition-colors focus:border-brand";

function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return FORMATO_DATA_HORA.format(data);
}

function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let valor = bytes;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice += 1;
  }
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unidades[indice]}`;
}

function formatarDuracao(job: AgentJob): string {
  if (!job.startedAt) return "—";
  const inicio = new Date(job.startedAt).getTime();
  const fim = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
  const segundos = Math.max(0, Math.round((fim - inicio) / 1000));
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos} min ${resto} s`;
}

function formatarDecorrido(inicioIso: string | null, agora: number): string {
  if (!inicioIso) return "0 s";
  const inicio = new Date(inicioIso).getTime();
  if (Number.isNaN(inicio)) return "0 s";
  const segundos = Math.max(0, Math.floor((agora - inicio) / 1000));
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  return `${minutos} min ${segundos % 60} s`;
}

const FUSO_AGENDA = "America/Sao_Paulo";
const PARTES_FUSO = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_AGENDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type PartesFuso = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
};

/** Data/hora de um instante no fuso America/Sao_Paulo (independente do navegador). */
function partesNoFuso(data: Date): PartesFuso {
  const partes: Record<string, number> = {};
  for (const parte of PARTES_FUSO.formatToParts(data)) {
    if (parte.type !== "literal") partes[parte.type] = Number(parte.value);
  }
  return {
    ano: partes.year,
    mes: partes.month,
    dia: partes.day,
    // 24:00 do Intl corresponde à meia-noite do dia seguinte; normaliza.
    hora: partes.hour % 24,
    minuto: partes.minute,
  };
}

/** Instante UTC correspondente a uma data/hora civil em America/Sao_Paulo. */
function instanteNoFuso(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto, 0);
  let tentativa = new Date(alvo);
  // Duas correções bastam: o deslocamento do fuso muda no máximo 1 h por vez.
  for (let i = 0; i < 2; i += 1) {
    const atual = partesNoFuso(tentativa);
    const comoUtc = Date.UTC(atual.ano, atual.mes - 1, atual.dia, atual.hora, atual.minuto, 0);
    tentativa = new Date(tentativa.getTime() + (alvo - comoUtc));
  }
  return tentativa;
}

/**
 * Próximas execuções da agenda no fuso America/Sao_Paulo (o servidor agenda
 * nesse fuso; o navegador pode estar em outro).
 */
function proximasExecucoes(
  agenda: Pick<AgentSchedule, "enabled" | "time" | "weekdays"> | null,
  quantidade = 3,
): Date[] {
  if (!agenda || !agenda.enabled || agenda.weekdays.length === 0) return [];
  const [hora, minuto] = agenda.time.split(":").map(Number);
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return [];

  const agora = new Date();
  const hoje = partesNoFuso(agora);
  const datas: Date[] = [];
  for (let adiante = 0; adiante <= 14 && datas.length < quantidade; adiante += 1) {
    const diaSemana = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + adiante)).getUTCDay();
    if (!agenda.weekdays.includes(diaSemana)) continue;
    const candidato = instanteNoFuso(hoje.ano, hoje.mes, hoje.dia + adiante, hora, minuto);
    if (candidato.getTime() > agora.getTime()) datas.push(candidato);
  }
  return datas;
}

function rotuloStatus(status: AgentJobStatus): string {
  switch (status) {
    case "QUEUED":
      return "Na fila";
    case "RUNNING":
      return "Em andamento";
    case "SUCCESS":
      return "Concluído";
    case "FAILED":
      return "Falhou";
    default:
      return status;
  }
}

function classesStatus(status: AgentJobStatus): string {
  switch (status) {
    case "SUCCESS":
      return "bg-[rgba(27,153,86,0.12)] text-[#15844a]";
    case "FAILED":
      return "bg-[#fdecea] text-[#b42318]";
    case "RUNNING":
      return "bg-[#e8f0fe] text-[#1a4fa0]";
    default:
      return "bg-[#eef1f4] text-[#697077]";
  }
}

function StatusBadge({ status }: { status: AgentJobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4 ${classesStatus(status)}`}
    >
      {rotuloStatus(status)}
    </span>
  );
}

function IconePasso({ status }: { status: AgentStepStatus }) {
  if (status === "done") {
    return <CircleCheck size={16} className="shrink-0 text-brand" aria-hidden="true" />;
  }
  if (status === "running") {
    return (
      <LoaderCircle
        size={16}
        className="shrink-0 animate-spin text-[#1a4fa0]"
        aria-hidden="true"
      />
    );
  }
  if (status === "error") {
    return <CircleX size={16} className="shrink-0 text-danger" aria-hidden="true" />;
  }
  return <Circle size={16} className="shrink-0 text-[#c1c7cd]" aria-hidden="true" />;
}

function Card({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-1.5 text-[#697077]">
        {icone}
        <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide">
          {titulo}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function BackupClient({
  online,
  erroAgente,
  agoraISO,
  health,
  status,
  jobs,
  backups,
  schedule,
  podeExecutar,
  podeAgendar,
  podeRestaurar,
}: BackupClientProps) {
  const router = useRouter();
  const mostrarAviso = useAviso();

  const [job, setJob] = useState<AgentJob | null>(status?.current ?? null);
  const [monitorado, setMonitorado] = useState<string | null>(status?.current?.id ?? null);
  const ciclosSemJob = useRef(0);
  const [agora, setAgora] = useState(() => new Date(agoraISO).getTime());
  const [erro, setErro] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [agendaAberta, setAgendaAberta] = useState(false);
  const [restaurarAberta, setRestaurarAberta] = useState(false);

  const proximo = useMemo(() => {
    if (!schedule) return "—";
    if (!schedule.enabled) return "Agenda desativada";
    const [data] = proximasExecucoes(schedule, 1);
    return data ? FORMATO_DATA_HORA.format(data) : "Nenhum dia selecionado";
  }, [schedule]);

  // Tempo decorrido do job em andamento.
  useEffect(() => {
    if (!monitorado) return;
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [monitorado]);

  // Polling de 1 s enquanto o job estiver na fila ou em execução.
  useEffect(() => {
    if (!monitorado) return;
    let cancelado = false;
    ciclosSemJob.current = 0;

    const consultar = async () => {
      try {
        const resposta = await fetch("/api/backup/status", { cache: "no-store" });
        const dados = (await resposta.json()) as RespostaStatus;
        if (cancelado) return;

        if (!dados.agentOnline || !dados.status) {
          setErro(dados.error ?? "Agente indisponível.");
          setMonitorado(null);
          return;
        }

        const atual = dados.status.current;
        const ultimo = dados.status.last;
        const encontrado =
          atual && atual.id === monitorado
            ? atual
            : ultimo && ultimo.id === monitorado
              ? ultimo
              : null;

        if (!encontrado) {
          // A1: o agente reiniciou e o job saiu do current/last. Para de
          // consultar em vez de fazer polling para sempre.
          ciclosSemJob.current += 1;
          if (ciclosSemJob.current >= 10) {
            setErro(
              "A operação foi interrompida: o agente não reconhece mais este job. Verifique o histórico.",
            );
            setMonitorado(null);
          }
          return;
        }

        ciclosSemJob.current = 0;
        setJob(encontrado);
        setErro(null);

        if (encontrado.status === "SUCCESS" || encontrado.status === "FAILED") {
          setMonitorado(null);
          if (encontrado.status === "SUCCESS") {
            mostrarAviso(
              encontrado.type === "RESTORE" ? "Restauração concluída." : "Backup concluído.",
            );
          } else {
            mostrarAviso(encontrado.message || "A operação falhou.", "erro");
          }
          router.refresh();
        }
      } catch {
        if (cancelado) return;
        setErro("Não foi possível consultar o agente.");
        setMonitorado(null);
      }
    };

    consultar();
    const intervalo = setInterval(consultar, 1000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [monitorado, mostrarAviso, router]);

  const ultimoBackup = useMemo(
    () => jobs?.find((item) => item.type === "BACKUP") ?? null,
    [jobs],
  );

  const espacoUsado = useMemo(
    () => (backups ?? []).reduce((total, arquivo) => total + arquivo.size, 0),
    [backups],
  );

  const linhas = useMemo<LinhaJob[]>(
    () =>
      (jobs ?? []).slice(0, 50).map((item) => ({
        id: item.id,
        tipo: item.type === "RESTORE" ? "Restauração" : "Backup",
        status: item.status,
        origem: item.requestedBy ? `Usuário #${item.requestedBy}` : "Agendador",
        inicio: formatarDataHora(item.startedAt),
        duracao: formatarDuracao(item),
        arquivo: item.fileName ?? "—",
        mensagem: item.message || "—",
      })),
    [jobs],
  );

  const colunas = useMemo<Column<LinhaJob>[]>(
    () => [
      { key: "tipo", label: "Tipo", width: "12%" },
      {
        key: "status",
        label: "Status",
        width: "13%",
        align: "center",
        render: (valor) => <StatusBadge status={valor as AgentJobStatus} />,
      },
      { key: "origem", label: "Origem", width: "12%" },
      { key: "inicio", label: "Início", width: "15%" },
      { key: "duracao", label: "Duração", width: "10%" },
      { key: "arquivo", label: "Arquivo", width: "18%" },
      { key: "mensagem", label: "Mensagem" },
    ],
    [],
  );

  const ocupado = Boolean(monitorado);
  const emAndamento = job !== null;
  const backupAtivo = job?.type === "BACKUP" ? "Backup" : "Restauração";

  async function fazerBackup() {
    setErro(null);
    setIniciando(true);

    try {
      const resultado = await iniciarBackup();

      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }

      ciclosSemJob.current = 0;
      setJob(resultado.job);
      setAgora(Date.now());
      setMonitorado(resultado.job.id);
      mostrarAviso("Backup iniciado.");
    } catch {
      setErro("Não foi possível iniciar o backup.");
    } finally {
      setIniciando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!online && (
        <div className="flex items-start gap-2 rounded-xl border border-[#f3c6c2] bg-[#fdf3f2] p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[#b42318]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="m-0 font-sans text-sm font-semibold text-[#b42318]">
              Agente local indisponível
            </p>
            <p className="m-0 mt-0.5 font-sans text-xs text-[#b42318]">
              {erroAgente ?? "O serviço NexusAgent não respondeu. Verifique o serviço no servidor."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <Card titulo="Agente" icone={<Server size={14} aria-hidden="true" />}>
          <span
            className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 font-sans text-xs font-semibold ${
              online
                ? "bg-[rgba(27,153,86,0.12)] text-[#15844a]"
                : "bg-[#fdecea] text-[#b42318]"
            }`}
          >
            {online ? "Online" : "Offline"}
          </span>
          <span className="font-sans text-xs text-[#697077]">
            {health ? `Versão ${health.version}` : "Sem resposta"}
          </span>
        </Card>

        <Card titulo="MySQL" icone={<Database size={14} aria-hidden="true" />}>
          <span className="font-display text-lg font-[590] text-ink-strong">
            {health?.mysql ?? "—"}
          </span>
          <span className="font-sans text-xs text-[#697077]">Serviço NexusMySQL84</span>
        </Card>

        <Card titulo="Último backup" icone={<Clock size={14} aria-hidden="true" />}>
          <span className="font-display text-lg font-[590] text-ink-strong">
            {ultimoBackup ? formatarDataHora(ultimoBackup.finishedAt ?? ultimoBackup.startedAt) : "—"}
          </span>
          {ultimoBackup ? (
            <StatusBadge status={ultimoBackup.status} />
          ) : (
            <span className="font-sans text-xs text-[#697077]">Nenhum backup registrado</span>
          )}
        </Card>

        <Card titulo="Próximo agendado" icone={<CalendarClock size={14} aria-hidden="true" />}>
          <span className="font-display text-lg font-[590] text-ink-strong">{proximo}</span>
          <span className="font-sans text-xs text-[#697077]">
            {status?.schedule ? `Retenção de ${status.schedule.retentionDays} dias` : "—"}
          </span>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {podeExecutar && (
          <Button
            label={iniciando ? "Iniciando…" : "Fazer backup agora"}
            iconLeft={<Play size={18} />}
            onClick={fazerBackup}
            disabled={!online || iniciando || ocupado}
          />
        )}
        {podeAgendar && (
          <Button
            label="Agendamento"
            variant="ghost"
            iconLeft={<CalendarClock size={18} />}
            onClick={() => setAgendaAberta(true)}
            disabled={!online || !schedule}
          />
        )}
        {podeRestaurar && (
          <Button
            label="Restaurar backup"
            variant="cancel"
            iconLeft={<RotateCcw size={18} />}
            onClick={() => setRestaurarAberta(true)}
            disabled={!online || ocupado || (backups?.length ?? 0) === 0}
          />
        )}
        <span className="ml-auto flex items-center gap-1.5 font-sans text-xs text-[#697077]">
          <HardDrive size={14} aria-hidden="true" />
          Espaço usado: <strong className="text-ink">{formatarBytes(espacoUsado)}</strong>
          {backups ? ` em ${backups.length} arquivo(s)` : ""}
        </span>
      </div>

      {erro && (
        <p role="alert" className="m-0 font-sans text-sm text-danger">
          {erro}
        </p>
      )}

      {emAndamento && job && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-display text-lg font-[590] text-ink-strong">
              {backupAtivo}{" "}
              {monitorado
                ? "em andamento"
                : job.status === "SUCCESS" || job.status === "FAILED"
                  ? "finalizado"
                  : "interrompido"}
            </h2>
            <StatusBadge status={job.status} />
            <span className="ml-auto font-sans text-xs text-[#697077]">
              {monitorado ? "Tempo decorrido: " : "Duração: "}
              {monitorado
                ? formatarDecorrido(job.startedAt, agora)
                : formatarDuracao(job)}
            </span>
          </div>

          <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  job.status === "FAILED" ? "bg-danger" : "bg-brand"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, job.percent))}%` }}
              />
            </div>
            <p className="m-0 mt-1.5 font-sans text-sm text-ink">
              <strong>{job.percent}%</strong>
              {job.step ? ` · ${job.step}` : ""}
              {job.message ? ` — ${job.message}` : ""}
            </p>
          </div>

          {job.steps.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1.5 p-0">
              {job.steps.map((passo) => (
                <li
                  key={passo.name}
                  className="flex min-w-0 items-start gap-2 font-sans text-sm text-ink"
                >
                  <IconePasso status={passo.status} />
                  <span className="min-w-0">
                    <span
                      className={
                        passo.status === "pending" ? "text-[#8a8f9a]" : "text-ink"
                      }
                    >
                      {passo.name}
                    </span>
                    {passo.message && (
                      <span className="block truncate font-sans text-xs text-[#697077]">
                        {passo.message}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 font-display text-lg font-[590] text-ink-strong">Histórico</h2>
          <span className="font-sans text-xs text-[#697077]">
            {jobs ? `${linhas.length} de ${jobs.length} registro(s)` : "Sem dados"}
          </span>
        </div>

        {jobs === null ? (
          <p className="m-0 rounded-lg bg-[#f7f9fb] px-4 py-6 text-center font-sans text-sm text-[#697077]">
            Não foi possível carregar o histórico do agente.
          </p>
        ) : jobs.length === 0 ? (
          <p className="m-0 rounded-lg bg-[#f7f9fb] px-4 py-6 text-center font-sans text-sm text-[#697077]">
            Nenhum backup ou restauração registrados.
          </p>
        ) : (
          <DataTable columns={colunas} data={linhas} idField="id" pageSize={10} />
        )}
      </section>

      {agendaAberta && schedule && (
        <AgendaModal
          agenda={schedule}
          onClose={() => setAgendaAberta(false)}
          onSalvo={() => {
            setAgendaAberta(false);
            router.refresh();
          }}
        />
      )}

      {restaurarAberta && (
        <RestaurarModal
          backups={backups ?? []}
          onClose={() => setRestaurarAberta(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Agendamento                                                                */
/* -------------------------------------------------------------------------- */

function AgendaModal({
  agenda,
  onClose,
  onSalvo,
}: {
  agenda: AgentSchedule;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const mostrarAviso = useAviso();
  const [enabled, setEnabled] = useState(agenda.enabled);
  const [time, setTime] = useState(agenda.time);
  const [weekdays, setWeekdays] = useState<number[]>(agenda.weekdays);
  const [retentionDays, setRetentionDays] = useState(String(agenda.retentionDays));
  const [includeUploads, setIncludeUploads] = useState(agenda.includeUploads);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const previsao = useMemo(() => {
    return proximasExecucoes({ enabled, time, weekdays }, 3);
  }, [enabled, time, weekdays]);

  function alternarDia(dia: number) {
    setWeekdays((atual) =>
      atual.includes(dia) ? atual.filter((item) => item !== dia) : [...atual, dia].sort(),
    );
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (weekdays.length === 0) {
      setErro("Selecione ao menos um dia da semana.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await salvarAgenda({
        enabled,
        time,
        weekdays,
        retentionDays: Number(retentionDays),
        includeUploads,
      });

      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }

      mostrarAviso("Agendamento salvo.");
      onSalvo();
    } catch {
      setErro("Não foi possível salvar a agenda.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Agendamento de backup">
      <form className="flex flex-col gap-4" onSubmit={salvar}>
        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(evento) => setEnabled(evento.target.checked)}
          />
          Agenda ativa
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-xs font-semibold text-[#697077]">Horário</span>
            <input
              type="time"
              className={campoCls}
              value={time}
              onChange={(evento) => setTime(evento.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-sans text-xs font-semibold text-[#697077]">
              Retenção (dias)
            </span>
            <input
              type="number"
              min={1}
              max={365}
              className={campoCls}
              value={retentionDays}
              onChange={(evento) => setRetentionDays(evento.target.value)}
              required
            />
          </label>
        </div>

        <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend className="mb-1 p-0 font-sans text-xs font-semibold text-[#697077]">
            Dias da semana
          </legend>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((rotulo, dia) => {
              const marcado = weekdays.includes(dia);
              return (
                <label
                  key={rotulo}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-sans text-sm ${
                    marcado
                      ? "border-brand bg-[rgba(27,153,86,0.08)] text-ink"
                      : "border-border-input bg-white text-[#697077]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={marcado}
                    onChange={() => alternarDia(dia)}
                  />
                  {rotulo}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          <input
            type="checkbox"
            checked={includeUploads}
            onChange={(evento) => setIncludeUploads(evento.target.checked)}
          />
          Incluir uploads no backup
        </label>

        <div className="rounded-lg bg-[#f7f9fb] px-3 py-2.5">
          <p className="m-0 font-sans text-xs font-semibold text-[#697077]">
            Próximas execuções
          </p>
          {previsao.length === 0 ? (
            <p className="m-0 mt-1 font-sans text-sm text-[#8a8f9a]">
              {!enabled
                ? "Agenda desativada."
                : weekdays.length === 0
                  ? "Selecione ao menos um dia."
                  : "Horário inválido."}
            </p>
          ) : (
            <ul className="m-0 mt-1 list-none p-0 font-sans text-sm text-ink">
              {previsao.map((data) => (
                <li key={data.toISOString()}>{FORMATO_DATA_HORA.format(data)}</li>
              ))}
            </ul>
          )}
        </div>

        {erro && (
          <p role="alert" className="m-0 font-sans text-sm text-danger">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button label="Cancelar" variant="ghost" onClick={onClose} disabled={salvando} />
          <Button
            label={salvando ? "Salvando…" : "Salvar agendamento"}
            type="submit"
            disabled={salvando || weekdays.length === 0}
          />
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Restauração                                                                */
/* -------------------------------------------------------------------------- */

function RestaurarModal({
  backups,
  onClose,
}: {
  backups: AgentBackupFile[];
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState(backups[0]?.name ?? "");
  const [incluirUploads, setIncluirUploads] = useState(true);
  const [confirmacao, setConfirmacao] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [redirecionando, setRedirecionando] = useState(false);

  const arquivoSelecionado = backups.find((item) => item.name === fileName);
  const temUploads = arquivoSelecionado?.hasUploads === true;
  // B4: sem snapshot de uploads do backup escolhido, a opção é forçada a "não".
  const includeUploads = incluirUploads && temUploads;

  const fecharModal = () => {
    // M7: durante o envio/redirecionamento o modal não fecha (Esc, X, backdrop).
    if (enviando || redirecionando) return;
    onClose();
  };

  async function restaurar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const formData = new FormData();
      formData.set("fileName", fileName);
      formData.set("includeUploads", includeUploads ? "true" : "false");
      formData.set("confirmacao", confirmacao);
      formData.set("senha", senha);

      const resultado = await iniciarRestauracao(formData);

      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }

      // A aplicação será reiniciada pela restauração: a página estática do Caddy
      // continua acompanhando o job pelo `status.json`.
      setRedirecionando(true);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /progresso/ é a página estática do Caddy, fora do App Router.
      window.location.href = "/progresso/";
    } catch {
      setErro("Não foi possível iniciar a restauração.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open onClose={fecharModal} title="Restaurar backup">
      <form className="flex flex-col gap-4" onSubmit={restaurar}>
        <div className="flex items-start gap-2 rounded-lg border border-[#f3c6c2] bg-[#fdf3f2] px-3 py-2.5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#b42318]" aria-hidden="true" />
          <div className="min-w-0 font-sans text-sm text-[#8a2a22]">
            <p className="m-0 font-semibold">Operação destrutiva e irreversível.</p>
            <ul className="m-0 mt-1 list-disc pl-4">
              <li>O sistema ficará indisponível durante a restauração.</li>
              <li>O banco de dados e, se marcado, os uploads serão substituídos.</li>
              <li>Dados e movimentações posteriores ao backup serão perdidos.</li>
              <li>A auditoria volta ao ponto do backup.</li>
            </ul>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-semibold text-[#697077]">Arquivo</span>
          <select
            className={campoCls}
            value={fileName}
            onChange={(evento) => setFileName(evento.target.value)}
            required
          >
            {backups.map((arquivo) => (
              <option key={arquivo.name} value={arquivo.name}>
                {arquivo.name} · {formatarBytes(arquivo.size)} ·{" "}
                {formatarDataHora(arquivo.modifiedAt)}
                {arquivo.hasUploads ? "" : " · sem uploads"}
              </option>
            ))}
          </select>
        </label>

        {!temUploads && (
          <p className="m-0 rounded-lg bg-[#fff8e1] px-3 py-2 font-sans text-sm text-[#7a5b00]">
            Este backup não tem snapshot de uploads. A restauração será apenas do banco; os
            uploads atuais serão mantidos.
          </p>
        )}

        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          <input
            type="checkbox"
            checked={includeUploads}
            onChange={(evento) => setIncluirUploads(evento.target.checked)}
            disabled={!temUploads}
          />
          Restaurar também os uploads
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-semibold text-[#697077]">
            Digite RESTAURAR para confirmar
          </span>
          <input
            type="text"
            className={campoCls}
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
            placeholder="RESTAURAR"
            autoComplete="off"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-semibold text-[#697077]">Sua senha</span>
          <input
            type="password"
            className={campoCls}
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {erro && (
          <p role="alert" className="m-0 font-sans text-sm text-danger">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            label="Cancelar"
            variant="ghost"
            onClick={onClose}
            disabled={enviando || redirecionando}
          />
          <Button
            label={
              redirecionando
                ? "Redirecionando…"
                : enviando
                  ? "Iniciando…"
                  : "Iniciar restauração"
            }
            variant="cancel"
            type="submit"
            disabled={enviando || redirecionando}
          />
        </div>
      </form>
    </Modal>
  );
}
