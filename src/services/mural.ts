import { muralDAO, type MuralMensagemRegistro } from "@/dao/mural";
import { fimDoDiaSaoPaulo } from "@/lib/datas";

export type MuralMensagem = MuralMensagemRegistro;

export type MuralMensagemForm = {
  titulo?: string | null;
  conteudo?: string | null;
  data_expiracao?: string | null;
};

function normalizarTitulo(titulo: string | null | undefined): string | null {
  const valor = titulo?.trim();
  return valor ? valor : null;
}

function normalizarExpiracao(iso: string | null | undefined): Date | null {
  const valor = iso?.trim();
  if (!valor) return null;
  const data = fimDoDiaSaoPaulo(valor);
  if (!data) throw new Error("Data de expiração inválida.");
  return data;
}

export class MuralService {
  /** Mural visível a qualquer usuário autenticado (sem permissão de leitura). */
  async listarAtivas(agora: Date = new Date()): Promise<MuralMensagem[]> {
    return muralDAO.listarAtivas(agora);
  }

  /** Histórico: automáticas e manuais desativadas/expiradas, sem exclusão. */
  async listarAnteriores(agora: Date = new Date()): Promise<MuralMensagem[]> {
    return muralDAO.listarAnteriores(agora);
  }

  async criar(form: MuralMensagemForm, id_usuario: number) {
    const conteudo = form.conteudo?.trim();
    if (!conteudo) throw new Error("O conteúdo da mensagem é obrigatório.");

    return muralDAO.criar({
      id_usuario,
      titulo: normalizarTitulo(form.titulo),
      conteudo,
      data_publicacao: new Date(),
      data_expiracao: normalizarExpiracao(form.data_expiracao),
      automatica: false,
      ativo: true,
      chave: null,
    });
  }

  async atualizar(id: number, form: MuralMensagemForm) {
    const atual = await muralDAO.getById(id);
    if (!atual) throw new Error("Mensagem não encontrada.");

    const agora = new Date();
    const expirada =
      atual.data_expiracao !== null && atual.data_expiracao <= agora;
    if (!atual.ativo || expirada) {
      throw new Error("Mensagens anteriores são somente leitura.");
    }

    if (atual.automatica) {
      throw new Error("Mensagens automáticas são somente leitura.");
    }

    const conteudo = form.conteudo?.trim();
    if (!conteudo) throw new Error("O conteúdo da mensagem é obrigatório.");

    return muralDAO.atualizar(id, {
      titulo: normalizarTitulo(form.titulo),
      conteudo,
      data_expiracao: normalizarExpiracao(form.data_expiracao),
    });
  }

  async desativar(id: number) {
    const atual = await muralDAO.getById(id);
    if (!atual) throw new Error("Mensagem não encontrada.");
    if (atual.automatica) {
      throw new Error("Mensagens automáticas são somente leitura.");
    }
    return muralDAO.desativar(id);
  }
}

export const muralService = new MuralService();
