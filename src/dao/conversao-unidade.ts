import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";

const AUDIT_ENTIDADE = "ConversaoUnidade";

export class ConversaoUnidadeDAO {
  async list() {
    return prisma.conversaoUnidade.findMany({ orderBy: { nome: "asc" } });
  }

  async getById(id: number) {
    return prisma.conversaoUnidade.findUnique({ where: { id_conversao: id } });
  }

  async create(
    data: { nome: string; fator: number; descricao?: string },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.conversaoUnidade.create({ data });
      await registrarAuditoria(
        id_usuario, "CRIAR", AUDIT_ENTIDADE, created.id_conversao,
        null,
        { nome: data.nome, fator: data.fator, descricao: data.descricao ?? null },
        tx,
      );
      return created;
    });
  }

  async update(
    id: number,
    data: { nome?: string; fator?: number; descricao?: string },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.conversaoUnidade.findUniqueOrThrow({ where: { id_conversao: id } });
      const depois = await tx.conversaoUnidade.update({ where: { id_conversao: id }, data });
      await registrarAuditoria(
        id_usuario, "ALTERAR", AUDIT_ENTIDADE, id,
        { nome: antes.nome, fator: antes.fator, descricao: antes.descricao },
        { nome: depois.nome, fator: depois.fator, descricao: depois.descricao },
        tx,
      );
      return depois;
    });
  }

  /**
   * Exclui a unidade fisicamente e desvincula os produtos que a usavam como padrão.
   */
  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.conversaoUnidade.findUniqueOrThrow({ where: { id_conversao: id } });

      await tx.produto.updateMany({
        where: { id_conversao_padrao: id },
        data: { id_conversao_padrao: null },
      });

      await tx.conversaoUnidade.delete({ where: { id_conversao: id } });

      await registrarAuditoria(
        id_usuario, "EXCLUIR", AUDIT_ENTIDADE, id,
        { nome: antes.nome, fator: antes.fator, descricao: antes.descricao },
        null,
        tx,
      );
    });
  }
}

export const conversaoUnidadeDAO = new ConversaoUnidadeDAO();
