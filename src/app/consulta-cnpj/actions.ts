"use server";

import { requireUser } from "@/lib/auth";
import { usuarioPodeAlguma } from "@/lib/permissoes";
import { consultarCnpjBrasilApi, type ResultadoConsultaCnpj } from "@/services/consulta-cnpj";

const PERMISSOES_CONSULTA = [
  "fornecedor.criar",
  "fornecedor.alterar",
  "destinatario.criar",
  "destinatario.alterar",
];

/** Consulta o CNPJ na BrasilAPI para preencher fornecedor ou destinatário. */
export async function consultarCnpj(cnpj: string): Promise<ResultadoConsultaCnpj> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_CONSULTA))) {
    return { error: "Sem permissão." };
  }
  return consultarCnpjBrasilApi(cnpj);
}
