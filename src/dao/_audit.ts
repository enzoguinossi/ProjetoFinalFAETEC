import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AcaoAuditoria = "CRIAR" | "ALTERAR" | "DESATIVAR" | "EXCLUIR";

export async function registrarAuditoria(
  id_usuario: number,
  acao: AcaoAuditoria,
  entidade: string,
  id_entidade_afetada: number,
  dados_anteriores?: Record<string, unknown> | null,
  dados_novos?: Record<string, unknown> | null,
) {
  await prisma.registroAuditoria.create({
    data: {
      id_usuario,
      acao,
      entidade,
      id_entidade_afetada,
      data_hora: new Date(),
      dados_anteriores: (dados_anteriores ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      dados_novos: (dados_novos ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}

export type AuditavelParams = {
  id_usuario: number;
  entidade: string;
  id_entidade_afetada: number;
};