import { prisma } from "@/lib/prisma";

export class TipoCodigoDAO {
  async list() {
    return prisma.tipoCodigo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  }

  async getByNome(nome: string) {
    return prisma.tipoCodigo.findUnique({ where: { nome } });
  }
}

export const tipoCodigoDAO = new TipoCodigoDAO();
