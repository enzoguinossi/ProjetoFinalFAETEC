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

  async getByNomes(nomes: string[]) {
    if (nomes.length === 0) return [];
    return prisma.tipoCodigo.findMany({ where: { nome: { in: nomes } } });
  }
}

export const tipoCodigoDAO = new TipoCodigoDAO();
