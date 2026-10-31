import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";

export type Db = Prisma.TransactionClient | PrismaClient;

/** Dono do anexo: exatamente um entre produto, funcionário e expedição/nota. */
export type AnexoDono =
  | { tipo: "produto"; id: number }
  | { tipo: "funcionario"; id: number }
  | { tipo: "expedicao_nota"; id: number };

export type AnexoInput = {
  nome_arquivo: string;
  url: string;
  tipo_mime?: string | null;
};

export type AnexoRow = {
  id_anexo: number;
  nome_arquivo: string;
  url: string;
  tipo_mime: string | null;
  data_upload: Date;
  ativo: boolean;
  id_usuario: number | null;
  id_produto: number | null;
  id_funcionario: number | null;
  id_expedicao_nota: number | null;
};

const AUDIT_ENTIDADE = "Anexo";

const CAMPOS_DONO = [
  "id_produto",
  "id_funcionario",
  "id_expedicao_nota",
] as const;

/**
 * Valida exatamente um dono em um objeto com os três campos opcionais.
 * Usado pelo serviço antes de qualquer escrita (zero ou dois donos = erro).
 */
export function validarDonoUnico(dono: {
  id_produto?: number | null;
  id_funcionario?: number | null;
  id_expedicao_nota?: number | null;
}): AnexoDono {
  const preenchidos = CAMPOS_DONO.filter(
    (campo) => dono[campo] !== null && dono[campo] !== undefined,
  );
  if (preenchidos.length !== 1) {
    throw new Error("O anexo deve ter exatamente um dono (produto, funcionário ou expedição/nota).");
  }
  const campo = preenchidos[0]!;
  const id = Number(dono[campo]);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Dono do anexo inválido.");
  }
  if (campo === "id_produto") return { tipo: "produto", id };
  if (campo === "id_funcionario") return { tipo: "funcionario", id };
  return { tipo: "expedicao_nota", id };
}

/** `where` do Prisma para o dono; valida o id. */
export function whereDono(dono: AnexoDono): {
  id_produto?: number;
  id_funcionario?: number;
  id_expedicao_nota?: number;
} {
  if (!Number.isInteger(dono.id) || dono.id <= 0) {
    throw new Error("Dono do anexo inválido.");
  }
  if (dono.tipo === "produto") return { id_produto: dono.id };
  if (dono.tipo === "funcionario") return { id_funcionario: dono.id };
  if (dono.tipo === "expedicao_nota") return { id_expedicao_nota: dono.id };
  throw new Error("Tipo de dono do anexo inválido.");
}

function validarFoto(foto: AnexoInput): AnexoInput {
  const nome = foto.nome_arquivo?.trim();
  const url = foto.url?.trim();
  if (!nome) throw new Error("O nome do arquivo do anexo é obrigatório.");
  if (!url) throw new Error("A URL do anexo é obrigatória.");
  return { nome_arquivo: nome, url, tipo_mime: foto.tipo_mime ?? null };
}

/** Dados para auditoria do anexo. */
function snapshot(anexo: AnexoRow) {
  return {
    id_anexo: anexo.id_anexo,
    nome_arquivo: anexo.nome_arquivo,
    url: anexo.url,
    tipo_mime: anexo.tipo_mime,
    ativo: anexo.ativo,
    id_produto: anexo.id_produto,
    id_funcionario: anexo.id_funcionario,
    id_expedicao_nota: anexo.id_expedicao_nota,
  };
}

export class AnexoDAO {
  /** Cria as linhas de anexo para o dono, com auditoria `Anexo/CRIAR`. */
  async criar(
    dono: AnexoDono,
    fotos: AnexoInput[],
    id_usuario: number,
    client: Db = prisma,
  ): Promise<AnexoRow[]> {
    const alvo = whereDono(dono);
    if (!Array.isArray(fotos) || fotos.length === 0) return [];

    const criados: AnexoRow[] = [];
    for (const foto of fotos) {
      const dados = validarFoto(foto);
      const criado = await client.anexo.create({
        data: {
          ...alvo,
          ...dados,
          id_usuario,
          data_upload: new Date(),
          ativo: true,
        },
      });
      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        criado.id_anexo,
        null,
        { dono, ...snapshot(criado) },
        client as Prisma.TransactionClient,
      );
      criados.push(criado);
    }
    return criados;
  }

  /** Ativos do dono, do mais recente para o mais antigo. */
  async listarAtivos(dono: AnexoDono, client: Db = prisma): Promise<AnexoRow[]> {
    return client.anexo.findMany({
      where: { ...whereDono(dono), ativo: true },
      orderBy: [{ data_upload: "desc" }, { id_anexo: "desc" }],
    });
  }

  /** Foto atual do dono: o anexo ativo mais recente. */
  async fotoAtual(dono: AnexoDono, client: Db = prisma): Promise<AnexoRow | null> {
    return client.anexo.findFirst({
      where: { ...whereDono(dono), ativo: true },
      orderBy: [{ data_upload: "desc" }, { id_anexo: "desc" }],
    });
  }

  /** Desativa um anexo (soft delete) com auditoria. */
  async desativar(
    id_anexo: number,
    id_usuario: number,
    client: Db = prisma,
  ): Promise<AnexoRow | null> {
    const antes = await client.anexo.findUnique({ where: { id_anexo } });
    if (!antes || !antes.ativo) return null;

    const depois = await client.anexo.update({
      where: { id_anexo },
      data: { ativo: false },
    });
    await registrarAuditoria(
      id_usuario,
      "DESATIVAR",
      AUDIT_ENTIDADE,
      id_anexo,
      snapshot(antes),
      snapshot(depois),
      client as Prisma.TransactionClient,
    );
    return depois;
  }

  /** Desativa todos os ativos do dono e devolve as URLs removidas. */
  async desativarAtivos(
    dono: AnexoDono,
    id_usuario: number,
    client: Db = prisma,
  ): Promise<string[]> {
    const ativos = await this.listarAtivos(dono, client);
    const urls: string[] = [];
    for (const anexo of ativos) {
      const desativado = await this.desativar(anexo.id_anexo, id_usuario, client);
      if (desativado) urls.push(desativado.url);
    }
    return urls;
  }
}

export const anexoDAO = new AnexoDAO();
