import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";
import type { CodigoInput } from "@/lib/codigo";

type Db = Prisma.TransactionClient;

export class VeiculoDAO {
  async list(params: ListParams & { status?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.VeiculoWhereInput = { ativo: true };
    if (params.status) where.status = params.status as Prisma.VeiculoWhereInput["status"];
    if (params.search) {
      where.OR = [
        { placa: { contains: params.search } },
        { modelo: { contains: params.search } },
      ];
    }
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

  async create(data: { placa: string; modelo?: string; codigos?: CodigoInput[] }, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const v = await tx.veiculo.create({ data: { placa: data.placa, modelo: data.modelo, status: "DISPONIVEL" } });
      for (const c of data.codigos ?? []) {
        await tx.veiculoCodigo.create({
          data: { id_veiculo: v.id_veiculo, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }
      await registrarAuditoria(
        id_usuario, "CRIAR", "Veiculo", v.id_veiculo,
        null,
        { placa: data.placa, modelo: data.modelo, codigos: data.codigos ?? [] },
        tx,
      );
      return v;
    });
  }

  async update(id: number, data: { placa?: string; modelo?: string; status?: "DISPONIVEL" | "INDISPONIVEL" | "EM_ROTA"; codigos?: CodigoInput[] }, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.veiculo.findUniqueOrThrow({ where: { id_veiculo: id }, include: { veiculoCodigos: true } });
      const depois = await tx.veiculo.update({ where: { id_veiculo: id }, data: { placa: data.placa, modelo: data.modelo, status: data.status } });

      if (data.codigos !== undefined) {
        await tx.veiculoCodigo.deleteMany({ where: { id_veiculo: id } });
        for (const c of data.codigos) {
          await tx.veiculoCodigo.create({
            data: { id_veiculo: id, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
          });
        }
      }

      await registrarAuditoria(
        id_usuario, "ALTERAR", "Veiculo", id,
        { placa: antes.placa, modelo: antes.modelo, status: antes.status, codigos: antes.veiculoCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })) },
        { placa: depois.placa, modelo: depois.modelo, status: depois.status, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })) },
        tx,
      );
      return depois;
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [remessas] = await Promise.all([
      client.remessa.count({ where: { id_veiculo: id } }),
    ]);
    const vinculos: string[] = [];
    if (remessas > 0) vinculos.push(`${remessas} remessa(s)`);
    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este veículo", vinculos);

      await tx.veiculoCodigo.deleteMany({ where: { id_veiculo: id } });
      await tx.veiculo.delete({ where: { id_veiculo: id } });
      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Veiculo", id,
        { id_veiculo: id },
        null,
        tx,
      );
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.veiculo.findUniqueOrThrow({ where: { id_veiculo: id } });
      const depois = await tx.veiculo.update({ where: { id_veiculo: id }, data: { ativo: false } });
      await registrarAuditoria(
        id_usuario, "DESATIVAR", "Veiculo", id,
        { ativo: antes.ativo },
        { ativo: depois.ativo },
        tx,
      );
      return depois;
    });
  }
}

export const veiculoDAO = new VeiculoDAO();