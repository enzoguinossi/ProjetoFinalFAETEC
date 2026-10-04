"use server";
import { destinatarioDAO } from "@/dao/destinatario";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";

export type DestinatarioListRow = {
  id_destinatario: number;
  codigo: string;
  razao: string;
};

export async function searchDestinatariosList(query: string): Promise<DestinatarioListRow[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPode(user, "destinatario.listar"))) return [];
  const data = await destinatarioDAO.search(query);
  return data.map((d) => ({
    id_destinatario: d.id_destinatario,
    codigo: formatarCodigo(d.id_destinatario),
    razao: d.pessoaJuridica.razao_social,
  }));
}