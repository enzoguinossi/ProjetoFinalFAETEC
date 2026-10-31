import {
  anexoDAO,
  validarDonoUnico,
  type AnexoDono,
  type AnexoInput,
  type AnexoRow,
  type Db,
} from "@/dao/anexo";
import { prisma } from "@/lib/prisma";

/**
 * Regras dos anexos, independentes do dono. Produto e funcionário usam
 * `substituirFoto` (no máximo 1 ativa); a tentativa de entrega usa
 * `criarAnexos` (N fotos, without remoção depois de registrada).
 */
export class AnexoService {
  /** Exige exatamente um dono entre produto/funcionário/expedição-nota. */
  validarDono(dono: {
    id_produto?: number | null;
    id_funcionario?: number | null;
    id_expedicao_nota?: number | null;
  }): AnexoDono {
    return validarDonoUnico(dono);
  }

  async criarAnexos(
    dono: AnexoDono,
    fotos: AnexoInput[],
    id_usuario: number,
    tx: Db = prisma,
  ): Promise<AnexoRow[]> {
    if (!Array.isArray(fotos) || fotos.length === 0) return [];
    return anexoDAO.criar(dono, fotos, id_usuario, tx);
  }

  async listarAtivos(dono: AnexoDono, tx: Db = prisma): Promise<AnexoRow[]> {
    return anexoDAO.listarAtivos(dono, tx);
  }

  async fotoAtual(dono: AnexoDono, tx: Db = prisma): Promise<AnexoRow | null> {
    return anexoDAO.fotoAtual(dono, tx);
  }

  /**
   * Troca a foto do cadastro: desativa os ativos do dono e cria o novo. As URLs
   * antigas são devolvidas para o chamador remover do disco **após o commit**.
   * Quando `tx` é informado, tudo acontece na transação do cadastro.
   */
  async substituirFoto(
    dono: AnexoDono,
    foto: AnexoInput,
    id_usuario: number,
    tx: Db = prisma,
  ): Promise<{ anexo: AnexoRow; urlsAntigas: string[] }> {
    const urlsAntigas = await anexoDAO.desativarAtivos(dono, id_usuario, tx);
    const [anexo] = await anexoDAO.criar(dono, [foto], id_usuario, tx);
    if (!anexo) throw new Error("Não foi possível gravar a foto.");
    return { anexo, urlsAntigas };
  }

  /** Soft delete de um anexo, com auditoria. */
  async desativar(
    id_anexo: number,
    id_usuario: number,
    tx: Db = prisma,
  ): Promise<AnexoRow | null> {
    if (!Number.isInteger(id_anexo) || id_anexo <= 0) {
      throw new Error("Anexo inválido.");
    }
    return anexoDAO.desativar(id_anexo, id_usuario, tx);
  }
}

export const anexoService = new AnexoService();
