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
      endereco?: { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade: string; cep?: string; latitude?: number; longitude?: number };
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const pj = await tx.pessoaJuridica.create({ data: { razao_social: data.razao_social, cnpj: data.cnpj } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "PessoaJuridica", id_entidade_afetada: pj.id_pessoa_juridica, dados_novos: { razao_social: data.razao_social } },
      });

      let id_endereco: number | undefined;
      if (data.endereco) {
        const end = await tx.endereco.create({ data: data.endereco });
        id_endereco = end.id_endereco;
      }

      const forn = await tx.fornecedor.create({
        data: { id_pessoa_juridica: pj.id_pessoa_juridica, contato: data.contato, id_endereco },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Fornecedor", id_entidade_afetada: forn.id_fornecedor, dados_novos: { contato: data.contato ?? null } },
      });

      return tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: forn.id_fornecedor },
        include: { pessoaJuridica: true, endereco: true },
      });
    });
  }

  async update(
    id: number,
    data: {
      razao_social?: string; cnpj?: string; contato?: string;
      endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; cep?: string; latitude?: number; longitude?: number };
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: id },
        include: { pessoaJuridica: true, endereco: true },
      });

      if (data.razao_social !== undefined || data.cnpj !== undefined) {
        await tx.pessoaJuridica.update({
          where: { id_pessoa_juridica: antes.id_pessoa_juridica },
          data: { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, cnpj: data.cnpj ?? antes.pessoaJuridica.cnpj },
        });
      }

      if (data.endereco && antes.endereco) {
        const endData: any = {};
        for (const [k, v] of Object.entries(data.endereco)) {
          if (v !== undefined) endData[k] = v;
        }
        if (Object.keys(endData).length > 0) {
          await tx.endereco.update({ where: { id_endereco: antes.endereco.id_endereco }, data: endData });
        }
      } else if (data.endereco && !antes.endereco) {
        const end = await tx.endereco.create({ data: data.endereco as any });
        await tx.fornecedor.update({ where: { id_fornecedor: id }, data: { id_endereco: end.id_endereco } });
      }

      const depois = await tx.fornecedor.update({
        where: { id_fornecedor: id },
        data: { contato: data.contato ?? antes.contato },
      });

      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: "Fornecedor", id_entidade_afetada: id, dados_anteriores: { razao_social: antes.pessoaJuridica.razao_social, contato: antes.contato }, dados_novos: { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, contato: depois.contato } },
      });

      return depois;
    });
  }

  async verificarRelacionamentos(id: number) {
    const [notasEntrada] = await Promise.all([
      prisma.notaEntrada.count({ where: { id_fornecedor: id } }),
    ]);
    const vinculos: string[] = [];
    if (notasEntrada > 0) vinculos.push(`${notasEntrada} nota(s) de entrada`);
    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const f = await tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: id },
        include: { endereco: true },
      });
      await tx.fornecedorCodigo.deleteMany({ where: { id_fornecedor: id } });
      await tx.fornecedor.delete({ where: { id_fornecedor: id } });
      if (f.id_endereco) await tx.endereco.delete({ where: { id_endereco: f.id_endereco } });
      await tx.pessoaJuridica.delete({ where: { id_pessoa_juridica: f.id_pessoa_juridica } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "EXCLUIR", data_hora: new Date(), entidade: "Fornecedor", id_entidade_afetada: id, dados_anteriores: { id_fornecedor: id } },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.fornecedor.findUniqueOrThrow({ where: { id_fornecedor: id } });
      const depois = await tx.fornecedor.update({ where: { id_fornecedor: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", data_hora: new Date(), entidade: "Fornecedor", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const fornecedorDAO = new FornecedorDAO();