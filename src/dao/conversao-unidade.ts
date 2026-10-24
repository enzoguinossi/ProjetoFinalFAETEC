import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";

const AUDIT_ENTIDADE = "ConversaoUnidade";

const ERRO_PADRAO_EXCLUIR = "A unidade padrão não pode ser excluída.";
const ERRO_PADRAO_ALTERAR = "A unidade padrão não pode ser alterada.";
const ERRO_SEM_PADRAO = "Não há unidade padrão para revincular os produtos.";

export class ConversaoUnidadeDAO {
  async list() {
    return prisma.conversaoUnidade.findMany({ orderBy: { nome: "asc" } });
  }

  async getById(id: number) {
    return prisma.conversaoUnidade.findUnique({ where: { id_conversao: id } });
  }

  /** Unidade padrão do sistema (UNIDADE/1), ou `null` se não houver. */
  async getPadrao() {
    return prisma.conversaoUnidade.findFirst({ where: { padrao: true } });
  }

  async create(
    data: { nome: string; fator: number; descricao?: string },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.conversaoUnidade.create({
        data: { ...data, padrao: false },
      });
      await registrarAuditoria(
        id_usuario, "CRIAR", AUDIT_ENTIDADE, created.id_conversao,
        null,
        {
          nome: data.nome,
          fator: data.fator,
          descricao: data.descricao ?? null,
        },
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

      if (antes.padrao) {
        const mudouDados =
          (data.nome !== undefined && data.nome !== antes.nome) ||
          (data.fator !== undefined && data.fator !== antes.fator);
        if (mudouDados) throw new Error(ERRO_PADRAO_ALTERAR);
      }

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
   * Exclui a unidade fisicamente (a entidade não possui `ativo`).
   *
   * A unidade padrão não pode ser excluída. As demais podem: os produtos que
   * a usavam são revinculados à unidade padrão, pois a FK
   * `produto.ID_conversao_padrao` é obrigatória. O snapshot anterior fica na
   * auditoria, junto com a contagem de produtos revinculados.
   */
  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.conversaoUnidade.findUniqueOrThrow({ where: { id_conversao: id } });

      if (antes.padrao) throw new Error(ERRO_PADRAO_EXCLUIR);

      const padrao = await tx.conversaoUnidade.findFirst({ where: { padrao: true } });
      if (!padrao) throw new Error(ERRO_SEM_PADRAO);

      const revinculados = await tx.produto.updateMany({
        where: { id_conversao_padrao: id },
        data: { id_conversao_padrao: padrao.id_conversao },
      });

      await tx.conversaoUnidade.delete({ where: { id_conversao: id } });

      await registrarAuditoria(
        id_usuario, "EXCLUIR", AUDIT_ENTIDADE, id,
        { nome: antes.nome, fator: antes.fator, descricao: antes.descricao },
        { produtos_revinculados: revinculados.count },
        tx,
      );
    });
  }
}

export const conversaoUnidadeDAO = new ConversaoUnidadeDAO();
