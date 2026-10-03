import { prisma } from "@/lib/prisma";
import { tiposPermitidosPara, type EntidadeCodigo } from "@/lib/codigo";

export class TipoCodigoDAO {
  async list() {
    return prisma.tipoCodigo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  }

  async listParaEntidade(entidade: EntidadeCodigo) {
    return prisma.tipoCodigo.findMany({
      where: { ativo: true, nome: { in: tiposPermitidosPara(entidade) } },
      orderBy: { nome: "asc" },
    });
  }

  async getByNome(nome: string) {
    return prisma.tipoCodigo.findUnique({ where: { nome } });
  }
}

export const tipoCodigoDAO = new TipoCodigoDAO();
