import { prisma } from "@/lib/prisma";

export class ConversaoUnidadeDAO {
  async list() {
    return prisma.conversaoUnidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  }
}

export const conversaoUnidadeDAO = new ConversaoUnidadeDAO();
