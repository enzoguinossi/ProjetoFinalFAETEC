import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";
import type { CodigoInput } from "@/lib/codigo";
import type { ContatosInput } from "@/services/contato";

type Db = Prisma.TransactionClient;

/** Filtros da listagem de destinatários (não se aplicam aos seletores operacionais). */
export type DestinatarioListFiltros = {
  /** true = só ativos (default) | false = só inativos | null = todos */
  ativo?: boolean | null;
  /** Ids de `tipo_destinatario` (cadastro); vazio não filtra. */
  tipos?: number[];
  ufs?: string[];
};

export class DestinatarioDAO {
  async list(params: ListParams & DestinatarioListFiltros = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.DestinatarioWhereInput = {};
    if (params.ativo !== null) where.ativo = params.ativo ?? true;
    if (params.search) {
      where.pessoaJuridica = { razao_social: { contains: params.search } };
    }
    if (params.tipos && params.tipos.length > 0) {
      where.id_tipo_destinatario = { in: params.tipos };
    }
    if (params.ufs && params.ufs.length > 0) {
      where.endereco = { uf: { in: params.ufs } };
    }
    const [data, total] = await Promise.all([
      prisma.destinatario.findMany({
        skip, take,
        where,
        include: { pessoaJuridica: true, endereco: true, tipoDestinatario: true },
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
        tipoDestinatario: true,
        telefones: { where: { ativo: true } },
        emails: true,
        destinatarioCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  async create(
    data: {
      razao_social: string; nome_fantasia?: string; cnpj?: string;
      id_tipo_destinatario: number | null;
      endereco: { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade: string; uf?: string; cep?: string };
      codigos?: CodigoInput[];
    } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      let tipo: { id: number; nome: string } | null = null;
      if (data.id_tipo_destinatario !== null) {
        const encontrado = await tx.tipoDestinatario.findUnique({
          where: { id_tipo_destinatario: data.id_tipo_destinatario },
          select: { id_tipo_destinatario: true, nome: true },
        });
        if (!encontrado) throw new Error("Tipo de escola não encontrado.");
        tipo = {
          id: encontrado.id_tipo_destinatario,
          nome: encontrado.nome,
        };
      }

      const pj = await tx.pessoaJuridica.create({
        data: { razao_social: data.razao_social, nome_fantasia: data.nome_fantasia, cnpj: data.cnpj },
      });
      await registrarAuditoria(
        id_usuario, "CRIAR", "PessoaJuridica", pj.id_pessoa_juridica,
        null,
        { razao_social: data.razao_social, nome_fantasia: data.nome_fantasia ?? null },
        tx,
      );

      const end = await tx.endereco.create({ data: data.endereco });
      const dest = await tx.destinatario.create({
        data: {
          id_pessoa_juridica: pj.id_pessoa_juridica,
          id_tipo_destinatario: data.id_tipo_destinatario,
          id_endereco: end.id_endereco,
        },
      });
      await registrarAuditoria(
        id_usuario, "CRIAR", "Destinatario", dest.id_destinatario,
        null,
        { tipo, id_endereco: end.id_endereco, codigos: data.codigos ?? [], emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

      for (const c of data.codigos ?? []) {
        await tx.destinatarioCodigo.create({
          data: { id_destinatario: dest.id_destinatario, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }

      for (const e of data.emails ?? []) {
        await tx.destinatarioEmail.create({
          data: { id_destinatario: dest.id_destinatario, endereco: e.endereco, principal: e.principal },
        });
      }
      for (const t of data.telefones ?? []) {
        await tx.destinatarioTelefone.create({
          data: { id_destinatario: dest.id_destinatario, numero: t.numero, tipo: t.tipo, principal: t.principal },
        });
      }

      return tx.destinatario.findUniqueOrThrow({
        where: { id_destinatario: dest.id_destinatario },
        include: { pessoaJuridica: true, endereco: true, tipoDestinatario: true },
      });
    });
  }

  async update(
    id: number,
    data: {
      razao_social?: string; nome_fantasia?: string; cnpj?: string; id_tipo_destinatario?: number | null; ativo?: boolean;
      endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string };
      codigos?: CodigoInput[];
    } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.destinatario.findUniqueOrThrow({
        where: { id_destinatario: id },
        include: { pessoaJuridica: true, endereco: true, destinatarioCodigos: true, emails: true, telefones: true, tipoDestinatario: true },
      });

      /** O tipo vai para a auditoria com id e nome, para o diff ficar legível. */
      let tipoDepois: { id: number; nome: string } | null = null;
      if (data.id_tipo_destinatario === undefined) {
        tipoDepois = antes.tipoDestinatario
          ? { id: antes.tipoDestinatario.id_tipo_destinatario, nome: antes.tipoDestinatario.nome }
          : null;
      } else if (data.id_tipo_destinatario !== null) {
        const tipo = await tx.tipoDestinatario.findUnique({
          where: { id_tipo_destinatario: data.id_tipo_destinatario },
          select: { id_tipo_destinatario: true, nome: true },
        });
        if (!tipo) throw new Error("Tipo de escola não encontrado.");
        tipoDepois = { id: tipo.id_tipo_destinatario, nome: tipo.nome };
      }

      if (data.razao_social !== undefined || data.cnpj !== undefined || data.nome_fantasia !== undefined) {
        await tx.pessoaJuridica.update({
          where: { id_pessoa_juridica: antes.id_pessoa_juridica },
          data: {
            razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social,
            nome_fantasia: data.nome_fantasia ?? antes.pessoaJuridica.nome_fantasia,
            cnpj: data.cnpj ?? antes.pessoaJuridica.cnpj,
          },
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
          id_tipo_destinatario:
            data.id_tipo_destinatario === undefined
              ? antes.id_tipo_destinatario
              : data.id_tipo_destinatario,
          ativo: data.ativo ?? antes.ativo,
        },
      });

      if (data.codigos !== undefined) {
        await tx.destinatarioCodigo.deleteMany({ where: { id_destinatario: id } });
        for (const c of data.codigos) {
          await tx.destinatarioCodigo.create({
            data: { id_destinatario: id, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
          });
        }
      }

      if (data.emails !== undefined) {
        await tx.destinatarioEmail.deleteMany({ where: { id_destinatario: id } });
        for (const e of data.emails) {
          await tx.destinatarioEmail.create({
            data: { id_destinatario: id, endereco: e.endereco, principal: e.principal },
          });
        }
      }
      if (data.telefones !== undefined) {
        await tx.destinatarioTelefone.deleteMany({ where: { id_destinatario: id } });
        for (const t of data.telefones) {
          await tx.destinatarioTelefone.create({
            data: { id_destinatario: id, numero: t.numero, tipo: t.tipo, principal: t.principal },
          });
        }
      }

      await registrarAuditoria(
        id_usuario,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        "Destinatario",
        id,
        { razao_social: antes.pessoaJuridica.razao_social, nome_fantasia: antes.pessoaJuridica.nome_fantasia, tipo: antes.tipoDestinatario ? { id: antes.tipoDestinatario.id_tipo_destinatario, nome: antes.tipoDestinatario.nome } : null, ativo: antes.ativo, codigos: antes.destinatarioCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: antes.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })), telefones: antes.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })) },
        { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, nome_fantasia: data.nome_fantasia ?? antes.pessoaJuridica.nome_fantasia, tipo: tipoDepois, ativo: depois.ativo, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

      return depois;
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [pedidos, notasSaida, coletas, percursos] = await Promise.all([
      client.pedidoEscola.count({ where: { id_destinatario: id } }),
      client.notaSaida.count({ where: { id_destinatario: id } }),
      client.coleta.count({ where: { id_destinatario: id } }),
      client.percursoDestinatario.count({ where: { id_destinatario: id } }),
    ]);

    const vinculos: string[] = [];
    if (pedidos > 0) vinculos.push(`${pedidos} pedido(s)`);
    if (notasSaida > 0) vinculos.push(`${notasSaida} nota(s) de saída`);
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
      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Destinatario", id,
        { id_destinatario: id },
        null,
        tx,
      );
    });
  }
}

export const destinatarioDAO = new DestinatarioDAO();