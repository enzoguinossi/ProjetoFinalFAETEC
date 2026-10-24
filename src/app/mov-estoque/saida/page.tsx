import SaidaClient from "../SaidaClient";
import { listarNotasSaida } from "../actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function MovEstoqueSaidaPage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.saida"]);
  if (!podeVer) redirect("/dashboard");

  const [podeCriarSaida, podeConsultarNota, podeAlterarNota, podeCancelarNota] =
    await Promise.all([
      usuarioPode(user, "nota_saida.criar"),
      usuarioPode(user, "nota_saida.consultar"),
      usuarioPode(user, "nota_saida.alterar"),
      usuarioPode(user, "nota_saida.cancelar"),
    ]);

  const inicialSaida = await listarNotasSaida({ page: 1, limit: 20 });

  return (
    <>
      <SaidaClient
        inicialSaida={inicialSaida}
        podeCriarSaida={podeCriarSaida}
        podeConsultarNota={podeConsultarNota}
        podeAlterarNota={podeAlterarNota}
        podeCancelarNota={podeCancelarNota}
      />
    </>
  );
}
