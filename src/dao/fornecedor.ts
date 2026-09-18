import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams } from "@/types";

export class FornecedorDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.fornecedor.findMany({
        skip, take,
        where: { ativo: true },
        include: { pessoaJuridica: true, endereco: true },
        orderBy: { id_fornecedor: "desc" },
      }),
      prisma.fornecedor.count({ where: { ativo: true } }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.fornecedor.findUnique({
      where: { id_fornecedor: id },
      include: {
        pessoaJuridica: true,
        endereco: true,
        telefones: { where: { ativo: true } },
        emails: true,
        fornecedorCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  async create(
    data: {
      razao_social: string; cnpj?: string; contato?: string;
      id_endereco?: number;
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const pj = await tx.pessoaJuridica.create({ data: { razao_social: data.razao_social, cnpj: data.cnpj } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", entidade: "PessoaJuridica", id_entidade_afetada: pj.id_pessoa_juridica, dados_novos: { razao_social: data.razao_social } },
      });
      const forn = await tx.fornecedor.create({
        data: { id_pessoa_juridica: pj.id_pessoa_juridica, contato: data.contato, id_endereco: data.id_endereco },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", entidade: "Fornecedor", id_entidade_afetada: forn.id_fornecedor, dados_novos: { contato: data.contato ?? null } },
      });
      return tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: forn.id_fornecedor },
        include: { pessoaJuridica: true },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.fornecedor.findUniqueOrThrow({ where: { id_fornecedor: id } });
      const depois = await tx.fornecedor.update({ where: { id_fornecedor: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", entidade: "Fornecedor", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const fornecedorDAO = new FornecedorDAO();