"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { comPermissao } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { muralDAO } from "@/dao/mural";
import { muralService, type MuralMensagem, type MuralMensagemForm } from "@/services/mural";

export type MuralMensagemDTO = {
  id: number;
  titulo: string | null;
  conteudo: string;
  data_publicacao: string;
  data_expiracao: string | null;
  automatica: boolean;
  ativo: boolean;
  autor: string;
};

export type MuralActionResult = { success: true } | { error: string };

function serializar(mensagem: MuralMensagem): MuralMensagemDTO {
  return {
    id: mensagem.id_mensagem_mural,
    titulo: mensagem.titulo,
    conteudo: mensagem.conteudo,
    data_publicacao: mensagem.data_publicacao.toISOString(),
    data_expiracao: mensagem.data_expiracao?.toISOString() ?? null,
    automatica: mensagem.automatica,
    ativo: mensagem.ativo,
    autor: mensagem.autor,
  };
}

/** Histórico para o modal "Ver anteriores" — disponível a qualquer sessão. */
export async function listarMensagensAnteriores(): Promise<MuralMensagemDTO[]> {
  await requireUser();
  const mensagens = await muralService.listarAnteriores();
  return mensagens.map(serializar);
}

export async function criarMensagemMural(form: MuralMensagemForm): Promise<MuralActionResult> {
  return comPermissao("mural.criar", async (user) => {
    try {
      await muralService.criar(form, user.id_usuario);
      revalidatePath("/dashboard");
      return { success: true };
    } catch (erro) {
      return { error: mensagemDeErro(erro, "Erro ao publicar a mensagem.") };
    }
  });
}

export async function atualizarMensagemMural(
  id: number,
  form: MuralMensagemForm,
): Promise<MuralActionResult> {
  return comPermissao("mural.alterar", async () => {
    try {
      await muralService.atualizar(id, form);
      revalidatePath("/dashboard");
      return { success: true };
    } catch (erro) {
      return { error: mensagemDeErro(erro, "Erro ao alterar a mensagem.") };
    }
  });
}

export async function desativarMensagemMural(id: number): Promise<MuralActionResult> {
  return comPermissao("mural.excluir", async () => {
    try {
      await muralService.desativar(id);
      revalidatePath("/dashboard");
      return { success: true };
    } catch (erro) {
      return { error: mensagemDeErro(erro, "Erro ao desativar a mensagem.") };
    }
  });
}

/** Contagem para o sino — por usuário, consultada periodicamente. */
export async function contarNovasMensagens(): Promise<number> {
  const user = await requireUser();
  return muralDAO.contarNovas(user.id_usuario);
}

export async function marcarMuralVisto(): Promise<{ success: true }> {
  const user = await requireUser();
  await muralDAO.marcarVisto(user.id_usuario);
  return { success: true };
}
