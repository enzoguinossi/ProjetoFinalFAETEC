import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams } from "@/types";

export class VeiculoDAO {
  async list(params: PaginationParams & { status?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.status) where.status = params.status;
    const [data, total] = await Promise.all([
      prisma.veiculo.findMany({ skip, take, where, orderBy: { placa: "asc" } }),
      prisma.veiculo.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.veiculo.findUnique({
      where: { id_veiculo: id },
      include: { veiculoCodigos: { include: { tipoCodigo: true } } },
    });
  }

  async create(data: { placa: string; modelo?: string; capacidade?: number }, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const v = await tx.veiculo.create({ data: { ...data, status: "DISPONIVEL" } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Veiculo", id_entidade_afetada: v.id_veiculo, dados_novos: { placa: data.placa, modelo: data.modelo, capacidade: data.capacidade } },
      });
      return v;
    });
  }

  async update(id: number, data: { placa?: string; modelo?: string; capacidade?: number; status?: "DISPONIVEL" | "INDISPONIVEL" | "EM_ROTA" }, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.veiculo.findUniqueOrThrow({ where: { id_veiculo: id } });
      const depois = await tx.veiculo.update({ where: { id_veiculo: id }, data });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: "Veiculo", id_entidade_afetada: id, dados_anteriores: { placa: antes.placa, modelo: antes.modelo, capacidade: antes.capacidade, status: antes.status }, dados_novos: { placa: depois.placa, modelo: depois.modelo, capacidade: depois.capacidade, status: depois.status } },
      });
      return depois;
    });
  }

  async verificarRelacionamentos(id: number) {
    const [remessas] = await Promise.all([
      prisma.remessa.count({ where: { id_veiculo: id } }),
    ]);
    const vinculos: string[] = [];
    if (remessas > 0) vinculos.push(`${remessas} remessa(s)`);
    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      await tx.veiculoCodigo.deleteMany({ where: { id_veiculo: id } });
      await tx.veiculo.delete({ where: { id_veiculo: id } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "EXCLUIR", data_hora: new Date(), entidade: "Veiculo", id_entidade_afetada: id, dados_anteriores: { id_veiculo: id } },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.veiculo.findUniqueOrThrow({ where: { id_veiculo: id } });
      const depois = await tx.veiculo.update({ where: { id_veiculo: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", data_hora: new Date(), entidade: "Veiculo", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const veiculoDAO = new VeiculoDAO();