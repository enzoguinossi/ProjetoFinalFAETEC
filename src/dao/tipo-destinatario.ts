import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";

const AUDIT_ENTIDADE = "TipoDestinatario";

type Db = Prisma.TransactionClient;

export type TipoDestinatarioDados = {
  id_tipo_destinatario: number;
  codigo: string;
  nome: string;
  padrao: boolean;
};

const NOME_MAX = 191;
const LOCK_PADRAO = "nexus:tipo_destinatario_padrao";
const LOCK_TIMEOUT_SEGUNDOS = 10;

function normalizarNome(nome: string): string {
  return nome.trim();
}

/**
 * A action valida o formulário, mas o DAO também precisa recusar nome vazio e
 * longo para qualquer chamador (teste, script, outro serviço).
 */
function validarNome(nome: string): string {
  if (!nome) throw new Error("Nome é obrigatório.");
  if (nome.length > NOME_MAX) {
    throw new Error(`Nome muito longo (máximo ${NOME_MAX} caracteres).`);
  }
  return nome;
}

/** Código imutável a partir do nome (`Creche Municipal` → `CRECHE_MUNICIPAL`). */
function codigoBase(nome: string): string {
  const codigo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return codigo || "TIPO";
}

async function gerarCodigoUnico(tx: Db, nome: string): Promise<string> {
  const base = codigoBase(nome);
  let codigo = base;
  let sufixo = 2;
  while (await tx.tipoDestinatario.findUnique({ where: { codigo }, select: { id_tipo_destinatario: true } })) {
    codigo = `${base}_${sufixo}`;
    sufixo += 1;
  }
  return codigo;
}

async function garantirNomeUnico(tx: Db, nome: string, ignorarId?: number): Promise<void> {
  const existente = await tx.tipoDestinatario.findFirst({
    where: {
      nome,
      ...(ignorarId ? { NOT: { id_tipo_destinatario: ignorarId } } : {}),
    },
    select: { id_tipo_destinatario: true },
  });
  if (existente) throw new Error("Já existe um tipo de escola com este nome.");
}

/** Garante a invariante de um único padrão, desmarcando os demais. */
async function definirPadraoUnico(tx: Db, id: number): Promise<void> {
  await tx.tipoDestinatario.updateMany({
    where: { NOT: { id_tipo_destinatario: id }, padrao: true },
    data: { padrao: false },
  });
}

type ResultadoLock = { ok: number | bigint | null };

/**
 * Serializa a definição de padrão entre transações concorrentes.
 *
 * `GET_LOCK` é um mutex do MySQL/MariaDB preso à conexão — e a transação
 * interativa do Prisma usa uma única conexão. Depois do lock, a leitura
 * `FOR UPDATE` espera qualquer transação que já tenha gravado e ainda não
 * commitado, enxergando os dados atuais antes de desmarcar/inserir.
 */
async function comLockPadrao<T>(tx: Db, trabalho: () => Promise<T>): Promise<T> {
  const [resultado] = await tx.$queryRaw<ResultadoLock[]>`
    SELECT GET_LOCK(${LOCK_PADRAO}, ${LOCK_TIMEOUT_SEGUNDOS}) AS ok
  `;
  if (Number(resultado?.ok ?? 0) !== 1) {
    throw new Error("Não foi possível reservar o tipo padrão. Tente novamente.");
  }

  try {
    await tx.$queryRaw`
      SELECT id_tipo_destinatario FROM tipo_destinatario
      ORDER BY id_tipo_destinatario FOR UPDATE
    `;
    return await trabalho();
  } finally {
    await tx.$queryRaw`SELECT RELEASE_LOCK(${LOCK_PADRAO})`.catch(() => undefined);
  }
}

export class TipoDestinatarioDAO {
  async list() {
    const tipos = await prisma.tipoDestinatario.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { destinatarios: true } } },
    });
    return tipos.map(({ _count, ...tipo }) => ({
      ...tipo,
      total_destinatarios: _count.destinatarios,
    }));
  }

  async getById(id: number) {
    return prisma.tipoDestinatario.findUnique({
      where: { id_tipo_destinatario: id },
    });
  }

  /** Tipo padrão (no máximo um), usado como seleção inicial no novo destinatário. */
  async getPadrao() {
    return prisma.tipoDestinatario.findFirst({ where: { padrao: true } });
  }

  async create(data: { nome: string; padrao: boolean }, id_usuario: number) {
    const nome = validarNome(normalizarNome(data.nome));
    return prisma.$transaction(async (tx) => {
      const criar = async () => {
        await garantirNomeUnico(tx, nome);
        const codigo = await gerarCodigoUnico(tx, nome);
        const criado = await tx.tipoDestinatario.create({
          data: { codigo, nome, padrao: data.padrao },
        });
        if (criado.padrao) await definirPadraoUnico(tx, criado.id_tipo_destinatario);

        await registrarAuditoria(
          id_usuario, "CRIAR", AUDIT_ENTIDADE, criado.id_tipo_destinatario,
          null,
          { codigo: criado.codigo, nome: criado.nome, padrao: criado.padrao },
          tx,
        );
        return criado;
      };

      return data.padrao ? comLockPadrao(tx, criar) : criar();
    });
  }

  async update(
    id: number,
    data: { nome: string; padrao: boolean },
    id_usuario: number,
  ) {
    const nome = validarNome(normalizarNome(data.nome));
    return prisma.$transaction(async (tx) => {
      const alterar = async () => {
        const antes = await tx.tipoDestinatario.findUniqueOrThrow({
          where: { id_tipo_destinatario: id },
        });
        await garantirNomeUnico(tx, nome, id);

        const depois = await tx.tipoDestinatario.update({
          where: { id_tipo_destinatario: id },
          data: { nome, padrao: data.padrao },
        });
        if (depois.padrao) await definirPadraoUnico(tx, id);

        await registrarAuditoria(
          id_usuario, "ALTERAR", AUDIT_ENTIDADE, id,
          { codigo: antes.codigo, nome: antes.nome, padrao: antes.padrao },
          { codigo: depois.codigo, nome: depois.nome, padrao: depois.padrao },
          tx,
        );
        return depois;
      };

      return data.padrao ? comLockPadrao(tx, alterar) : alterar();
    });
  }

  /**
   * Exclusão física (o cadastro não possui `ativo`). A FK `ON DELETE SET NULL`
   * deixa os destinatários sem tipo; a auditoria guarda o tipo e os afetados.
   */
  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.tipoDestinatario.findUniqueOrThrow({
        where: { id_tipo_destinatario: id },
      });
      const afetados = await tx.destinatario.findMany({
        where: { id_tipo_destinatario: id },
        select: { id_destinatario: true },
        orderBy: { id_destinatario: "asc" },
      });

      await tx.tipoDestinatario.delete({ where: { id_tipo_destinatario: id } });

      await registrarAuditoria(
        id_usuario, "EXCLUIR", AUDIT_ENTIDADE, id,
        {
          codigo: antes.codigo,
          nome: antes.nome,
          padrao: antes.padrao,
          destinatarios_afetados: afetados.length,
          ids_destinatarios: afetados.map((d) => d.id_destinatario),
        },
        { destinatarios_sem_tipo: afetados.length },
        tx,
      );
    });
  }
}

export const tipoDestinatarioDAO = new TipoDestinatarioDAO();
