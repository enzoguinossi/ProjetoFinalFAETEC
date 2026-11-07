"use server";

import { funcionarioDAO } from "@/dao/funcionario";
import { codigoService } from "@/services/codigo";
import { contatoService } from "@/services/contato";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { formatarCodigo } from "@/lib/formatar";
import { validarCpf } from "@/lib/cpf";
import {
  processarImagemDoFormulario,
  removerImagemAnexo,
  salvarImagemAnexo,
} from "@/lib/imagem";
import { anexoService } from "@/services/anexo";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type FuncionarioListRow = {
  id_funcionario: number;
  codigo: string;
  nome: string;
  cargo: string;
  condutor: string;
};

export type FuncionarioFormData = {
  id_funcionario: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  condutor: boolean;
  ativo: boolean;
  /** Foto atual, derivada do anexo ativo. */
  foto_url: string | null;
  fotos: { id_anexo: number; url: string }[];
  codigos: { tipo: string; valor: string }[];
  emails: { endereco: string; principal: boolean }[];
  telefones: { numero: string; tipo: "CELULAR" | "FIXO" | "COMERCIAL"; principal: boolean }[];
};

/**
 * Lê o CPF do formulário: vazio → sem CPF; preenchido → precisa ser válido e
 * é gravado só com os dígitos.
 */
function lerCpf(formData: FormData): { cpf?: string } | { error: string } {
  const bruto = String(formData.get("cpf") ?? "").trim();
  if (!bruto) return {};
  const resultado = validarCpf(bruto);
  if (!resultado.ok) return { error: resultado.erro };
  return { cpf: resultado.cpf };
}

/** IDs de anexos marcados para remoção no formulário (`remover_anexos`). */
function lerRemoverAnexos(formData: FormData): number[] {
  const bruto = String(formData.get("remover_anexos") ?? "").trim();
  if (!bruto) return [];
  return bruto
    .split(",")
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
}

export async function listarFuncionarios(
  params: ListParams & { cargos?: string[]; condutor?: boolean } = {},
): Promise<PaginatedResult<FuncionarioListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.listar"))) return resultadoVazio(params);

  const cargos = Array.isArray(params.cargos)
    ? params.cargos.filter(
        (cargo): cargo is string => typeof cargo === "string" && cargo.trim().length > 0,
      )
    : undefined;

  const resultado = await funcionarioDAO.list({
    ...params,
    cargos,
    condutor: params.condutor === true ? true : undefined,
  });
  return {
    ...resultado,
    data: resultado.data.map((f) => ({
      id_funcionario: f.id_funcionario,
      codigo: formatarCodigo(f.id_funcionario),
      nome: f.pessoaFisica.nome,
      cargo: f.cargo ?? "",
      condutor: f.condutor ? "Sim" : "Não",
    })),
  };
}

/** Cargos distintos cadastrados — opções do filtro de cargo na listagem. */
export async function listarCargosFuncionarios(): Promise<string[]> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.listar"))) return [];
  return funcionarioDAO.listCargos();
}

export async function getFuncionario(id: number): Promise<FuncionarioFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["funcionario.consultar", "funcionario.alterar"]))) return null;

  const f = await funcionarioDAO.getById(id);
  if (!f) return null;
  return {
    id_funcionario: f.id_funcionario,
    nome: f.pessoaFisica.nome,
    cpf: f.pessoaFisica.cpf,
    cargo: f.cargo,
    condutor: f.condutor,
    ativo: f.ativo,
    foto_url: f.anexos[0]?.url ?? null,
    fotos: f.anexos.map((anexo) => ({ id_anexo: anexo.id_anexo, url: anexo.url })),
    codigos: f.funcionarioCodigos.map((c) => ({ tipo: c.tipoCodigo.nome, valor: c.codigo })),
    emails: f.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })),
    telefones: f.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })),
  };
}

export async function createFuncionario(formData: FormData) {
  return comPermissao("funcionario.criar", async (user) => {
    const nome = formData.get("nome") as string;
    if (!nome?.trim()) return { error: "Nome é obrigatório" };

    const cpfResult = lerCpf(formData);
    if ("error" in cpfResult) return { error: cpfResult.error };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FUNCIONARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    const fotoUrl = String(formData.get("foto_url") ?? "").trim() || undefined;
    const imagem = await processarImagemDoFormulario(
      formData,
      "foto_arquivo",
      fotoUrl,
    );
    if (imagem && "error" in imagem) return { error: imagem.error };

    let novaUrl: string | null = null;
    try {
      await funcionarioDAO.create(
        {
          nome: nome.trim(),
          cpf: cpfResult.cpf,
          cargo: (formData.get("cargo") as string) || undefined,
          condutor: formData.get("condutor") === "on",
          codigos: codigoResult.codigos,
          ...contatoResult.contatos,
        },
        user.id_usuario,
        async (tx, idFuncionario) => {
          if (!imagem) return;
          novaUrl = await salvarImagemAnexo(
            `funcionarios/${idFuncionario}`,
            imagem.buffer,
            imagem.hash,
          );
          await anexoService.criarAnexos(
            { tipo: "funcionario", id: idFuncionario },
            [
              {
                nome_arquivo: imagem.nome_arquivo,
                url: novaUrl,
                tipo_mime: imagem.tipo_mime,
              },
            ],
            user.id_usuario,
            tx,
          );
        },
      );
    } catch (e) {
      if (novaUrl) await removerImagemAnexo(novaUrl);
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateFuncionario(formData: FormData) {
  return comPermissao("funcionario.alterar", async (user) => {
    const id = Number(formData.get("id_funcionario"));
    if (!id) return { error: "ID inválido" };

    const nome = formData.get("nome") as string;
    if (!nome?.trim()) return { error: "Nome é obrigatório" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "funcionario.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const cpfResult = lerCpf(formData);
    if ("error" in cpfResult) return { error: cpfResult.error };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FUNCIONARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    const fotoUrl = String(formData.get("foto_url") ?? "").trim() || undefined;
    const imagem = await processarImagemDoFormulario(
      formData,
      "foto_arquivo",
      fotoUrl,
    );
    if (imagem && "error" in imagem) return { error: imagem.error };

    const dono = { tipo: "funcionario" as const, id };
    const removerIds = lerRemoverAnexos(formData);
    const urlsAntigas: string[] = [];
    let novaUrl: string | null = null;

    try {
      await funcionarioDAO.update(
        id,
        {
          nome: nome.trim(),
          cpf: cpfResult.cpf,
          cargo: (formData.get("cargo") as string) || undefined,
          condutor: formData.get("condutor") === "on",
          ativo,
          codigos: codigoResult.codigos,
          ...contatoResult.contatos,
        },
        user.id_usuario,
        async (tx) => {
          if (removerIds.length > 0) {
            const ativos = await anexoService.listarAtivos(dono, tx);
            for (const anexo of ativos) {
              if (!removerIds.includes(anexo.id_anexo)) continue;
              await anexoService.desativar(anexo.id_anexo, user.id_usuario, tx);
              urlsAntigas.push(anexo.url);
            }
          }
          if (imagem) {
            novaUrl = await salvarImagemAnexo(
              `funcionarios/${id}`,
              imagem.buffer,
              imagem.hash,
            );
            const troca = await anexoService.substituirFoto(
              dono,
              {
                nome_arquivo: imagem.nome_arquivo,
                url: novaUrl,
                tipo_mime: imagem.tipo_mime,
              },
              user.id_usuario,
              tx,
            );
            urlsAntigas.push(...troca.urlsAntigas);
          }
        },
      );
    } catch (e) {
      if (novaUrl) await removerImagemAnexo(novaUrl);
      return { error: mensagemDeErro(e) };
    }

    for (const url of urlsAntigas) {
      if (url !== novaUrl) await removerImagemAnexo(url);
    }

    return { success: true };
  });
}

export async function deleteFuncionario(id: number) {
  return comPermissao("funcionario.excluir", async (user) => {
    try {
      const urls = await funcionarioDAO.hardDelete(id, user.id_usuario);
      for (const url of urls) await removerImagemAnexo(url);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
