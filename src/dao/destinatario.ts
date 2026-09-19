import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams } from "@/types";

export class DestinatarioDAO {
  async list(params: PaginationParams & { search?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.search) {
      where.pessoaJuridica = { razao_social: { contains: params.search } };
    }
    const [data, total] = await Promise.all([
      prisma.destinatario.findMany({
        skip, take,
        where,
        include: { pessoaJuridica: true, endereco: true },
        orderBy: { id_destinatario: "desc" },
      }),
      prisma.destinatario.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.destinatario.findUnique({
      where: { id_destinatario: id },
      include: {
        pessoaJuridica: true,
        endereco: true,
        telefones: { where: { ativo: true } },
        emails: true,
        destinatarioCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  /**
   * Cria Destinatario + PessoaJuridica + Endereco em transação.
   */
  async create(
    data: {
      razao_social: string;
      cnpj?: string;
      tipo_destinatario: "ESCOLA" | "CRECHE";
      endereco: { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade: string; cep?: string; latitude?: number; longitude?: number };
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const pj = await tx.pessoaJuridica.create({
        data: { razao_social: data.razao_social, cnpj: data.cnpj },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "PessoaJuridica", id_entidade_afetada: pj.id_pessoa_juridica, dados_novos: { razao_social: data.razao_social } },
      });

      const end = await tx.endereco.create({ data: data.endereco });
      const dest = await tx.destinatario.create({
        data: { id_pessoa_juridica: pj.id_pessoa_juridica, tipo_destinatario: data.tipo_destinatario, id_endereco: end.id_endereco },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Destinatario", id_entidade_afetada: dest.id_destinatario, dados_novos: { tipo: data.tipo_destinatario, id_endereco: end.id_endereco } },
      });

      return tx.destinatario.findUniqueOrThrow({
        where: { id_destinatario: dest.id_destinatario },
        include: { pessoaJuridica: true, endereco: true },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.destinatario.findUniqueOrThrow({ where: { id_destinatario: id } });
      const depois = await tx.destinatario.update({ where: { id_destinatario: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", data_hora: new Date(), entidade: "Destinatario", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const destinatarioDAO = new DestinatarioDAO();