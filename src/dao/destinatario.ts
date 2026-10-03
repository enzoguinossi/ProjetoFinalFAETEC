import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type PaginationParams } from "@/types";

type Db = Prisma.TransactionClient;

export class DestinatarioDAO {
  async list(params: PaginationParams & { search?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.DestinatarioWhereInput = { ativo: true };
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

  async search(query: string, take = 50) {
    return prisma.destinatario.findMany({
      where: { ativo: true, pessoaJuridica: { razao_social: { contains: query } } },
      include: { pessoaJuridica: true },
      take,
      orderBy: { id_destinatario: "desc" },
    });
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

  async create(
    data: {
      razao_social: string; cnpj?: string;
      tipo_destinatario: "ESCOLA" | "CRECHE";
      endereco: { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade: string; cep?: string; latitude?: number; longitude?: number };
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const pj = await tx.pessoaJuridica.create({ data: { razao_social: data.razao_social, cnpj: data.cnpj } });
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

  async update(
    id: number,
    data: {
      razao_social?: string; cnpj?: string; tipo_destinatario?: "ESCOLA" | "CRECHE"; ativo?: boolean;
      endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; cep?: string; latitude?: number; longitude?: number };
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.destinatario.findUniqueOrThrow({
        where: { id_destinatario: id },
        include: { pessoaJuridica: true, endereco: true },
      });

      if (data.razao_social !== undefined || data.cnpj !== undefined) {
        await tx.pessoaJuridica.update({
          where: { id_pessoa_juridica: antes.id_pessoa_juridica },
          data: { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, cnpj: data.cnpj ?? antes.pessoaJuridica.cnpj },
        });
      }

      if (data.endereco) {
        const endData: Prisma.EnderecoUpdateInput = {};
        for (const [k, v] of Object.entries(data.endereco)) {
          if (v !== undefined) (endData as Record<string, unknown>)[k] = v;
        }
        if (Object.keys(endData).length > 0) {
          await tx.endereco.update({ where: { id_endereco: antes.id_endereco }, data: endData });
        }
      }

      const depois = await tx.destinatario.update({
        where: { id_destinatario: id },
        data: {
          tipo_destinatario: data.tipo_destinatario ?? antes.tipo_destinatario,
          ativo: data.ativo ?? antes.ativo,
        },
      });

      await tx.registroAuditoria.create({
        data: { id_usuario, acao: data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR", data_hora: new Date(), entidade: "Destinatario", id_entidade_afetada: id, dados_anteriores: { razao_social: antes.pessoaJuridica.razao_social, tipo: antes.tipo_destinatario, ativo: antes.ativo }, dados_novos: { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, tipo: depois.tipo_destinatario, ativo: depois.ativo } },
      });

      return depois;
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [notasSaida, pedidos, remessas, coletas, percursos] = await Promise.all([
      client.notaSaida.count({ where: { id_destinatario: id } }),
      client.pedidoEscola.count({ where: { id_destinatario: id } }),
      client.remessa.count({ where: { id_destinatario: id } }),
      client.coleta.count({ where: { id_destinatario: id } }),
      client.percursoDestinatario.count({ where: { id_destinatario: id } }),
    ]);

    const vinculos: string[] = [];
    if (notasSaida > 0) vinculos.push(`${notasSaida} nota(s) de saída`);
    if (pedidos > 0) vinculos.push(`${pedidos} pedido(s)`);
    if (remessas > 0) vinculos.push(`${remessas} remessa(s)`);
    if (coletas > 0) vinculos.push(`${coletas} coleta(s)`);
    if (percursos > 0) vinculos.push(`${percursos} percurso(s)`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este destinatário", vinculos);

      const d = await tx.destinatario.findUniqueOrThrow({
        where: { id_destinatario: id },
        include: { endereco: true },
      });
      await tx.destinatarioCodigo.deleteMany({ where: { id_destinatario: id } });
      await tx.destinatario.delete({ where: { id_destinatario: id } });
      await tx.endereco.delete({ where: { id_endereco: d.id_endereco } });
      await tx.pessoaJuridica.delete({ where: { id_pessoa_juridica: d.id_pessoa_juridica } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "EXCLUIR", data_hora: new Date(), entidade: "Destinatario", id_entidade_afetada: id, dados_anteriores: { id_destinatario: id } },
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