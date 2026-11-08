import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import {
  agentBackups,
  agentHealth,
  agentJobs,
  agentSchedule,
  agentStatus,
} from "@/lib/agent";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";

/**
 * Administração → Backup. Lê o NexusAgent (loopback) no servidor e entrega a
 * página já hidratada. Agente fora do ar não derruba a tela: os dados vão como
 * `null` e o cliente mostra o aviso.
 */
export default async function BackupPage() {
  const user = await requireUser();

  const [podeListar, podeExecutar, podeAgendar, podeRestaurar] = await Promise.all([
    usuarioPode(user, "backup.listar"),
    usuarioPode(user, "backup.executar"),
    usuarioPode(user, "backup.agendar"),
    usuarioPode(user, "backup.restaurar"),
  ]);

  if (!podeListar) redirect("/dashboard");

  const [saude, estado, tarefas, arquivos, agenda] = await Promise.all([
    agentHealth(),
    agentStatus(),
    agentJobs(50),
    agentBackups(),
    agentSchedule(),
  ]);

  const online = saude.ok && estado.ok;
  const erroAgente = !saude.ok ? saude.error : !estado.ok ? estado.error : null;

  return (
    <>
      <PageTitle>Backup</PageTitle>
      <BackupClient
        online={online}
        erroAgente={erroAgente}
        agoraISO={new Date().toISOString()}
        health={saude.ok ? saude.data : null}
        status={estado.ok ? estado.data : null}
        jobs={tarefas.ok ? tarefas.data : null}
        backups={arquivos.ok ? arquivos.data : null}
        schedule={agenda.ok ? agenda.data : null}
        podeExecutar={podeExecutar}
        podeAgendar={podeAgendar}
        podeRestaurar={podeRestaurar}
      />
    </>
  );
}
