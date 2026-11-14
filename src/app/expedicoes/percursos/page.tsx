import { redirect } from "next/navigation";

/** A tela de percursos passou a ser "Rotas"; mantém o link antigo funcionando. */
export default function PercursosPage() {
  redirect("/expedicoes/rotas");
}
