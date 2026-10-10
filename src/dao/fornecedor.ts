import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";
import type { CodigoInput } from "@/lib/codigo";
import type { ContatosInput } from "@/services/contato";

type Db = Prisma.TransactionClient;

export class FornecedorDAO {
  async list(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.FornecedorWhereInput = { ativo: true };
    if (params.search) where.pessoaJuridica = { razao_social: { contains: params.search } };
    const [data, total] = await Promise.all([
      prisma.fornecedor.findMany({
        skip, take,
        where,
        include: { pessoaJuridica: true, endereco: true },
        orderBy: { id_fornecedor: "desc" },
      }),
      prisma.fornecedor.count({ where }),
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
      endereco?: { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade: string; uf?: string; cep?: string; latitude?: number; longitude?: number };
      codigos?: CodigoInput[];
    } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const pj = await tx.pessoaJuridica.create({ data: { razao_social: data.razao_social, cnpj: data.cnpj } });
      await registrarAuditoria(
        id_usuario, "CRIAR", "PessoaJuridica", pj.id_pessoa_juridica,
        null,
        { razao_social: data.razao_social },
        tx,
      );

      let id_endereco: number | undefined;
      if (data.endereco) {
        const end = await tx.endereco.create({ data: data.endereco });
        id_endereco = end.id_endereco;
      }

      const forn = await tx.fornecedor.create({
        data: { id_pessoa_juridica: pj.id_pessoa_juridica, contato: data.contato, id_endereco },
      });
      await registrarAuditoria(
        id_usuario, "CRIAR", "Fornecedor", forn.id_fornecedor,
        null,
        { contato: data.contato ?? null, codigos: data.codigos ?? [], emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

      for (const c of data.codigos ?? []) {
        await tx.fornecedorCodigo.create({
          data: { id_fornecedor: forn.id_fornecedor, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }

      for (const e of data.emails ?? []) {
        await tx.fornecedorEmail.create({
          data: { id_fornecedor: forn.id_fornecedor, endereco: e.endereco, principal: e.principal },
        });
      }
      for (const t of data.telefones ?? []) {
        await tx.fornecedorTelefone.create({
          data: { id_fornecedor: forn.id_fornecedor, numero: t.numero, tipo: t.tipo, principal: t.principal },
        });
      }

      return tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: forn.id_fornecedor },
        include: { pessoaJuridica: true, endereco: true },
      });
    });
  }

  async update(
    id: number,
    data: {
      razao_social?: string; cnpj?: string; contato?: string; ativo?: boolean;
      endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string; latitude?: number; longitude?: number };
      codigos?: CodigoInput[];
    } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: id },
        include: { pessoaJuridica: true, endereco: true, fornecedorCodigos: true, emails: true, telefones: true },
      });

      if (data.razao_social !== undefined || data.cnpj !== undefined) {
        await tx.pessoaJuridica.update({
          where: { id_pessoa_juridica: antes.id_pessoa_juridica },
          data: { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, cnpj: data.cnpj ?? antes.pessoaJuridica.cnpj },
        });
      }

      if (data.endereco && antes.endereco) {
        const endData: Prisma.EnderecoUpdateInput = {};
        for (const [k, v] of Object.entries(data.endereco)) {
          if (v !== undefined) (endData as Record<string, unknown>)[k] = v;
        }
        if (Object.keys(endData).length > 0) {
          await tx.endereco.update({ where: { id_endereco: antes.endereco.id_endereco }, data: endData });
        }
      } else if (data.endereco && !antes.endereco) {
        const end = await tx.endereco.create({ data: data.endereco as Prisma.EnderecoCreateInput });
        await tx.fornecedor.update({ where: { id_fornecedor: id }, data: { id_endereco: end.id_endereco } });
      }

      const depois = await tx.fornecedor.update({
        where: { id_fornecedor: id },
        data: { contato: data.contato ?? antes.contato, ativo: data.ativo ?? antes.ativo },
      });

      if (data.codigos !== undefined) {
        await tx.fornecedorCodigo.deleteMany({ where: { id_fornecedor: id } });
        for (const c of data.codigos) {
          await tx.fornecedorCodigo.create({
            data: { id_fornecedor: id, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
          });
        }
      }

      if (data.emails !== undefined) {
        await tx.fornecedorEmail.deleteMany({ where: { id_fornecedor: id } });
        for (const e of data.emails) {
          await tx.fornecedorEmail.create({
            data: { id_fornecedor: id, endereco: e.endereco, principal: e.principal },
          });
        }
      }
      if (data.telefones !== undefined) {
        await tx.fornecedorTelefone.deleteMany({ where: { id_fornecedor: id } });
        for (const t of data.telefones) {
          await tx.fornecedorTelefone.create({
            data: { id_fornecedor: id, numero: t.numero, tipo: t.tipo, principal: t.principal },
          });
        }
      }

      await registrarAuditoria(
        id_usuario,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        "Fornecedor",
        id,
        { razao_social: antes.pessoaJuridica.razao_social, contato: antes.contato, ativo: antes.ativo, codigos: antes.fornecedorCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: antes.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })), telefones: antes.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })) },
        { razao_social: data.razao_social ?? antes.pessoaJuridica.razao_social, contato: depois.contato, ativo: depois.ativo, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

      return depois;
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [notasEntrada] = await Promise.all([
      client.notaEntrada.count({ where: { id_fornecedor: id } }),
    ]);
    const vinculos: string[] = [];
    if (notasEntrada > 0) vinculos.push(`${notasEntrada} nota(s) de entrada`);
    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este fornecedor", vinculos);

      const f = await tx.fornecedor.findUniqueOrThrow({
        where: { id_fornecedor: id },
        include: { endereco: true },
      });
      await tx.fornecedorCodigo.deleteMany({ where: { id_fornecedor: id } });
      await tx.fornecedor.delete({ where: { id_fornecedor: id } });
      if (f.id_endereco) await tx.endereco.delete({ where: { id_endereco: f.id_endereco } });
      await tx.pessoaJuridica.delete({ where: { id_pessoa_juridica: f.id_pessoa_juridica } });
      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Fornecedor", id,
        { id_fornecedor: id },
        null,
        tx,
      );
    });
  }
}

export const fornecedorDAO = new FornecedorDAO();