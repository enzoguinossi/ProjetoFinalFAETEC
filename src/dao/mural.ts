import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

const autorInclude = {
  usuario: {
    select: {
      login: true,
      funcionario: {
        select: { pessoaFisica: { select: { nome: true } } },
      },
    },
  },
} satisfies Prisma.MensagemMuralInclude;

type MensagemComAutor = Prisma.MensagemMuralGetPayload<{ include: typeof autorInclude }>;

/** Mensagem já normalizada para a UI: o autor vira texto ("Sistema" quando nulo). */
export type MuralMensagemRegistro = Omit<MensagemComAutor, "usuario"> & {
  autor: string;
};

function paraRegistro(mensagem: MensagemComAutor): MuralMensagemRegistro {
  const { usuario, ...resto } = mensagem;
  return {
    ...resto,
    autor:
      usuario?.funcionario?.pessoaFisica?.nome ??
      usuario?.login ??
      "Sistema",
  };
}

export type MuralMensagemInput = {
  id_usuario: number | null;
  titulo: string | null;
  conteudo: string;
  data_publicacao: Date;
  data_expiracao: Date | null;
  automatica: boolean;
  ativo: boolean;
  chave: string | null;
};

export class MuralDAO {
  /** Mensagens ativas e ainda não expiradas, mais recentes primeiro. */
  async listarAtivas(agora: Date = new Date()): Promise<MuralMensagemRegistro[]> {
    const mensagens = await prisma.mensagemMural.findMany({
      where: {
        ativo: true,
        OR: [{ data_expiracao: null }, { data_expiracao: { gt: agora } }],
      },
      include: autorInclude,
      orderBy: [{ data_publicacao: "desc" }, { id_mensagem_mural: "desc" }],
    });
    return mensagens.map(paraRegistro);
  }

  /**
   * Histórico do "Ver anteriores": automáticas e manuais já desativadas ou
   * expiradas. A mensagem nunca é apagada (RN004).
   */
  async listarAnteriores(agora: Date = new Date()): Promise<MuralMensagemRegistro[]> {
    const mensagens = await prisma.mensagemMural.findMany({
      where: {
        OR: [{ ativo: false }, { data_expiracao: { lte: agora } }],
      },
      include: autorInclude,
      orderBy: [{ data_publicacao: "desc" }, { id_mensagem_mural: "desc" }],
    });
    return mensagens.map(paraRegistro);
  }

  async getById(id: number): Promise<MuralMensagemRegistro | null> {
    const mensagem = await prisma.mensagemMural.findUnique({
      where: { id_mensagem_mural: id },
      include: autorInclude,
    });
    return mensagem ? paraRegistro(mensagem) : null;
  }

  async criar(data: MuralMensagemInput, client: Db = prisma) {
    return client.mensagemMural.create({ data });
  }

  async atualizar(
    id: number,
    data: Pick<MuralMensagemInput, "titulo" | "conteudo" | "data_expiracao">,
    client: Db = prisma,
  ) {
    return client.mensagemMural.update({
      where: { id_mensagem_mural: id },
      data,
    });
  }

  /** Desativação: sai das ativas e continua no histórico (sem hard delete). */
  async desativar(id: number, client: Db = prisma) {
    return client.mensagemMural.update({
      where: { id_mensagem_mural: id },
      data: { ativo: false },
    });
  }

  /**
   * Desativa uma automática e libera a chave (`null`), preservando o conteúdo
   * no histórico. A chave fica reservada apenas para a mensagem ativa.
   */
  async desativarAutomatica(id: number, client: Db = prisma) {
    return client.mensagemMural.update({
      where: { id_mensagem_mural: id },
      data: { ativo: false, chave: null },
    });
  }

  /**
   * Cria a mensagem automática da faixa ou reativa a mesma chave (idempotência
   * sob concorrência: dois terminais podem gerar o alerta ao mesmo tempo).
   */
  async upsertAutomatica(
    chave: string,
    data: Omit<MuralMensagemInput, "chave">,
    client: Db = prisma,
  ) {
    return client.mensagemMural.upsert({
      where: { chave },
      update: data,
      create: { ...data, chave },
    });
  }

  /** Mensagem automática ativa de um produto (chave `validade:{id}:{faixa}`). */
  async buscarAtivaPorChave(chave: string) {
    return prisma.mensagemMural.findFirst({ where: { chave, ativo: true } });
  }

  async listarAutomaticasAtivas() {
    return prisma.mensagemMural.findMany({
      where: { automatica: true, ativo: true },
      select: {
        id_mensagem_mural: true,
        chave: true,
        data_publicacao: true,
        data_expiracao: true,
      },
    });
  }

  /**
   * Quantidade de mensagens ativas publicadas depois da última leitura do
   * usuário. `mural_visto_em` nulo conta todas (primeiro acesso ao mural).
   */
  async contarNovas(id_usuario: number, agora: Date = new Date()): Promise<number> {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      select: { mural_visto_em: true },
    });
    if (!usuario) return 0;

    const vistoEm = usuario.mural_visto_em;
    return prisma.mensagemMural.count({
      where: {
        ativo: true,
        OR: [{ data_expiracao: null }, { data_expiracao: { gt: agora } }],
        ...(vistoEm ? { data_publicacao: { gt: vistoEm } } : {}),
      },
    });
  }

  /** Marca o mural como visto para este usuário (vale para todos os terminais). */
  async marcarVisto(id_usuario: number, agora: Date = new Date()) {
    return prisma.usuario.update({
      where: { id_usuario },
      data: { mural_visto_em: agora },
    });
  }

  /** Última leitura do mural por este usuário (`null` = nunca leu). */
  async obterVistoEm(id_usuario: number): Promise<Date | null> {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      select: { mural_visto_em: true },
    });
    return usuario?.mural_visto_em ?? null;
  }
}

export const muralDAO = new MuralDAO();
