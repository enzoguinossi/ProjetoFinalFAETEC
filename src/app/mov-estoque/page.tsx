import DashboardLayout from "@/components/DashboardLayout";
import MovEstoqueClient from "./MovEstoqueClient";
import {
  listarCondutoresSaida,
  listarNotasEntrada,
  listarNotasSaida,
  listarUnidadesEntrada,
  listarVeiculosSaida,
} from "./actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { resultadoVazio } from "@/types";
import type { CondutorItem, NotaSaidaListRow, VeiculoItem } from "./tipos";

export const dynamic = "force-dynamic";

export default async function MovEstoquePage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, [
    "estoque.ver_saldo",
    "estoque.entrada",
    "estoque.saida",
  ]);
  if (!podeVer) redirect("/dashboard");

  const podeCriar = await usuarioPode(user, "estoque.entrada");
  const podeVerSaida = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.saida"]);
  const podeCriarSaida = await usuarioPode(user, "estoque.saida");

  const [inicial, conversoes, inicialSaida, condutores, veiculos] = await Promise.all([
    listarNotasEntrada({ page: 1, limit: 20 }),
    podeCriar ? listarUnidadesEntrada() : Promise.resolve([]),
    podeVerSaida
      ? listarNotasSaida({ page: 1, limit: 20 })
      : Promise.resolve(resultadoVazio<NotaSaidaListRow>()),
    podeCriarSaida ? listarCondutoresSaida() : Promise.resolve<CondutorItem[]>([]),
    podeCriarSaida ? listarVeiculosSaida() : Promise.resolve<VeiculoItem[]>([]),
  ]);

  return (
    <DashboardLayout title="Movimentação de Estoque">
      <MovEstoqueClient
        inicial={inicial}
        conversoes={conversoes}
        podeCriar={podeCriar}
        inicialSaida={inicialSaida}
        podeVerSaida={podeVerSaida}
        podeCriarSaida={podeCriarSaida}
        condutores={condutores}
        veiculos={veiculos}
      />
    </DashboardLayout>
  );
}
