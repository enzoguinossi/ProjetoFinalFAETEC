import DashboardLayout from "@/components/DashboardLayout";
import SaidaClient from "../SaidaClient";
import { listarCondutoresSaida, listarNotasSaida, listarVeiculosSaida } from "../actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import type { CondutorItem, VeiculoItem } from "../tipos";

export const dynamic = "force-dynamic";

export default async function MovEstoqueSaidaPage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.saida"]);
  if (!podeVer) redirect("/dashboard");

  const podeCriarSaida = await usuarioPode(user, "estoque.saida");
  const podeCancelarRemessa = await usuarioPode(user, "remessa.alterar_status");

  const [inicialSaida, condutores, veiculos] = await Promise.all([
    listarNotasSaida({ page: 1, limit: 20 }),
    podeCriarSaida ? listarCondutoresSaida() : Promise.resolve<CondutorItem[]>([]),
    podeCriarSaida ? listarVeiculosSaida() : Promise.resolve<VeiculoItem[]>([]),
  ]);

  return (
    <DashboardLayout title="Movimentação de Estoque">
      <SaidaClient
        inicialSaida={inicialSaida}
        podeCriarSaida={podeCriarSaida}
        podeCancelarRemessa={podeCancelarRemessa}
        condutores={condutores}
        veiculos={veiculos}
      />
    </DashboardLayout>
  );
}
