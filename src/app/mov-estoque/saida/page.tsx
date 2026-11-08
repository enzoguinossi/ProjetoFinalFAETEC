import SaidaClient from "../SaidaClient";
import { listarDestinatariosSelecao, listarNotasSaida } from "../actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function MovEstoqueSaidaPage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.saida"]);
  if (!podeVer) redirect("/dashboard");

  const [podeCriarSaida, podeConsultarNota, podeAlterarNota, podeCancelarNota, podeRetirarNota] =
    await Promise.all([
      usuarioPode(user, "nota_saida.criar"),
      usuarioPode(user, "nota_saida.consultar"),
      usuarioPode(user, "nota_saida.alterar"),
      usuarioPode(user, "nota_saida.cancelar"),
      usuarioPode(user, "expedicao.alterar"),
    ]);

  const [inicialSaida, destinatarios] = await Promise.all([
    listarNotasSaida({ page: 1, limit: 20 }),
    // Opções do filtro de destinatário (vazio sem permissão de saída).
    listarDestinatariosSelecao({ page: 1, limit: 100 }),
  ]);

  return (
    <SaidaClient
      inicialSaida={inicialSaida}
      destinatarios={destinatarios.data}
      podeCriarSaida={podeCriarSaida}
      podeConsultarNota={podeConsultarNota}
      podeAlterarNota={podeAlterarNota}
      podeCancelarNota={podeCancelarNota}
      podeRetirarNota={podeRetirarNota}
    />
  );
}
