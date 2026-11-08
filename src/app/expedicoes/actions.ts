"use server";

import { expedicaoDAO, saldoPendente, type ExpedicaoListFiltros } from "@/dao/expedicao";
import { mensagemDeErro } from "@/dao/_errors";
import { expedicaoService } from "@/services/expedicao";
import {
  processarImagemWebp,
  removerImagemAnexo,
  salvarImagemAnexo,
} from "@/lib/imagem";
import { limitesDoDiaUtc } from "@/lib/datas";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import {
  resultadoVazio,
  STATUS_EXPEDICAO,
  type ListParams,
  type PaginatedResult,
  type StatusExpedicao,
} from "@/types";

const ROTULOS_STATUS_EXPEDICAO: Record<string, string> = {
  PLANEJADA: "Planejada",
  EM_PERCURSO: "Em percurso",
  CONCLUIDA: "Concluída",
};

const ROTULOS_STATUS_NOTA: Record<string, string> = {
  ABERTA: "Aberta",
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
};

/** Ids inteiros positivos, sem duplicatas; vazio/inválido não filtra. */
function idsFiltro(valores: unknown): number[] | undefined {
  if (!Array.isArray(valores)) return undefined;
  const ids = valores
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

/** Data `YYYY-MM-DD` válida; qualquer outro valor não filtra. */
function dataFiltro(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const texto = valor.trim();
  return limitesDoDiaUtc(texto, null).inicio ? texto : undefined;
}

export type ExpedicaoListRow = {
  id_expedicao: number;
  /** `YYYY-MM-DD`, pronto para exibição. */
  data_prevista: string;
  status: string;
  statusLabel: string;
  total_notas: number;
  destinatarios: string;
  veiculo: string;
};

export type ExpedicaoNotaItemRow = {
  id_item_nota_saida: number;
  descricao: string;
  qtd_esperada: number;
  qtd_entregue: number;
};

export type ExpedicaoNotaRow = {
  id_nota_saida: number;
  ordem_visita: number;
  codigo: string;
  destinatario: string | null;
  status: string;
  statusLabel: string;
  itens: number;
  saldo_pendente: number;
  itens_detalhe: ExpedicaoNotaItemRow[];
  justificativa: string | null;
  data_tentativa: string | null;
  usuario_tentativa: string | null;
  fotos: { id_anexo: number; nome_arquivo: string; url: string }[];
};

export type ExpedicaoFormData = {
  id_expedicao: number;
  data_prevista: string;
  observacao: string | null;
  id_veiculo: number;
  id_funcionario_condutor: number;
  veiculo: string;
  condutor: string;
  status: string;
  statusLabel: string;
  ativo: boolean;
  notas: ExpedicaoNotaRow[];
};

export type NotaElegivelRow = {
  id_nota_saida: number;
  codigo: string;
  destinatario: string;
  itens: number;
  saldo_pendente: number;
};

export type NotaElegivelParams = ListParams & { excludeIds?: number[] };

export type VeiculoExpedicaoRow = {
  id_veiculo: number;
  placa: string;
  modelo: string | null;
  status: string;
};

export type CondutorExpedicaoRow = {
  id_funcionario: number;
  nome: string;
};

export type DestinatarioExpedicaoRow = {
  id_destinatario: number;
  razao_social: string;
};

export type PercursoExpedicaoRow = {
  id_percurso: number;
  nome: string;
  destinatarios: number;
};

type NotaResumo = {
  notaSaida: {
    destinatario: { pessoaJuridica: { razao_social: string } } | null;
  };
};

type ExpedicaoResumo = {
  id_expedicao: number;
  data_prevista: Date;
  status: string;
  veiculo: { placa: string };
  notas: NotaResumo[];
};

type ExpedicaoDetalhe = {
  id_expedicao: number;
  data_prevista: Date;
  observacao: string | null;
  id_veiculo: number;
  id_funcionario_condutor: number;
  status: string;
  ativo: boolean;
  veiculo: { placa: string };
  condutor: { pessoaFisica: { nome: string } };
  notas: {
    id_nota_saida: number;
    ordem_visita: number;
    justificativa: string | null;
    data_tentativa: Date | null;
    usuarioTentativa: {
      funcionario: { pessoaFisica: { nome: string } };
    } | null;
    anexos: { id_anexo: number; nome_arquivo: string; url: string }[];
    notaSaida: {
      status: string;
      destinatario: { pessoaJuridica: { razao_social: string } } | null;
      itens: {
        id_item_nota_saida: number;
        qtd_esperada: number;
        qtd_entregue: number;
        produto: { descricao: string };
      }[];
    };
  }[];
};

function dataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function destinatariosDe(notas: NotaResumo[]): string {
  return [
    ...new Set(
      notas
        .map((nota) => nota.notaSaida.destinatario?.pessoaJuridica.razao_social)
        .filter((nome): nome is string => Boolean(nome)),
    ),
  ].join(", ");
}

function mapaResumo(expedicao: ExpedicaoResumo): ExpedicaoListRow {
  return {
    id_expedicao: expedicao.id_expedicao,
    data_prevista: dataISO(expedicao.data_prevista),
    status: expedicao.status,
    statusLabel:
      ROTULOS_STATUS_EXPEDICAO[expedicao.status] ?? expedicao.status,
    total_notas: expedicao.notas.length,
    destinatarios: destinatariosDe(expedicao.notas),
    veiculo: expedicao.veiculo.placa,
  };
}

function mapaDetalhe(expedicao: ExpedicaoDetalhe): ExpedicaoFormData {
  return {
    id_expedicao: expedicao.id_expedicao,
    data_prevista: dataISO(expedicao.data_prevista),
    observacao: expedicao.observacao,
    id_veiculo: expedicao.id_veiculo,
    id_funcionario_condutor: expedicao.id_funcionario_condutor,
    veiculo: expedicao.veiculo.placa,
    condutor: expedicao.condutor.pessoaFisica.nome,
    status: expedicao.status,
    statusLabel:
      ROTULOS_STATUS_EXPEDICAO[expedicao.status] ?? expedicao.status,
    ativo: expedicao.ativo,
    notas: expedicao.notas.map((nota) => ({
      id_nota_saida: nota.id_nota_saida,
      ordem_visita: nota.ordem_visita,
      codigo: formatarCodigo(nota.id_nota_saida),
      destinatario:
        nota.notaSaida.destinatario?.pessoaJuridica.razao_social ?? null,
      status: nota.notaSaida.status,
      statusLabel:
        ROTULOS_STATUS_NOTA[nota.notaSaida.status] ?? nota.notaSaida.status,
      itens: nota.notaSaida.itens.length,
      saldo_pendente: saldoPendente(nota.notaSaida.itens),
      itens_detalhe: nota.notaSaida.itens.map((item) => ({
        id_item_nota_saida: item.id_item_nota_saida,
        descricao: item.produto.descricao,
        qtd_esperada: Number(item.qtd_esperada),
        qtd_entregue: Number(item.qtd_entregue),
      })),
      justificativa: nota.justificativa,
      data_tentativa: nota.data_tentativa
        ? nota.data_tentativa.toLocaleDateString("pt-BR")
        : null,
      usuario_tentativa:
        nota.usuarioTentativa?.funcionario.pessoaFisica.nome ?? null,
      fotos: nota.anexos.map((anexo) => ({
        id_anexo: anexo.id_anexo,
        nome_arquivo: anexo.nome_arquivo,
        url: anexo.url,
      })),
    })),
  };
}

export async function listarExpedicoes(
  params: ListParams & ExpedicaoListFiltros = {},
): Promise<PaginatedResult<ExpedicaoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "expedicao.listar"))) {
    return resultadoVazio(params);
  }

  const status = Array.isArray(params.status)
    ? params.status.filter((valor): valor is StatusExpedicao =>
        (STATUS_EXPEDICAO as readonly string[]).includes(valor),
      )
    : undefined;

  const resultado = await expedicaoDAO.list({
    ...params,
    status,
    de: dataFiltro(params.de),
    ate: dataFiltro(params.ate),
    id_veiculo: idsFiltro(params.id_veiculo),
    id_funcionario_condutor: idsFiltro(params.id_funcionario_condutor),
    id_destinatario: idsFiltro(params.id_destinatario),
  });
  return { ...resultado, data: resultado.data.map(mapaResumo) };
}

export async function obterExpedicao(
  id: number,
): Promise<ExpedicaoFormData | null> {
  const user = await requireUser();
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.consultar",
      "expedicao.alterar",
    ]))
  ) {
    return null;
  }

  const expedicao = await expedicaoDAO.getById(id);
  return expedicao ? mapaDetalhe(expedicao) : null;
}

export async function listarNotasElegiveis(
  params: NotaElegivelParams = {},
): Promise<PaginatedResult<NotaElegivelRow>> {
  const user = await requireUser();
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.alterar",
      "expedicao.criar",
    ]))
  ) {
    return resultadoVazio(params);
  }

  const resultado = await expedicaoDAO.listNotasElegiveis(params);
  return {
    ...resultado,
    data: resultado.data.map((nota) => ({
      id_nota_saida: nota.id_nota_saida,
      codigo: formatarCodigo(nota.id_nota_saida),
      destinatario:
        nota.destinatario?.pessoaJuridica.razao_social ?? "Sem destinatário",
      itens: nota.itens.length,
      saldo_pendente: saldoPendente(nota.itens),
    })),
  };
}

export async function listarVeiculosParaExpedicao(
  params: ListParams = {},
): Promise<PaginatedResult<VeiculoExpedicaoRow>> {
  const user = await requireUser();
  // Opção de filtro da listagem: quem só lê (`listar`/`consultar`) também
  // precisa das opções; isto não concede nenhuma mutação.
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.criar",
      "expedicao.alterar",
      "expedicao.listar",
      "expedicao.consultar",
    ]))
  ) {
    return resultadoVazio(params);
  }

  const resultado = await expedicaoDAO.listVeiculos(params);
  return {
    ...resultado,
    data: resultado.data.map((veiculo) => ({
      id_veiculo: veiculo.id_veiculo,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      status: veiculo.status,
    })),
  };
}

export async function listarCondutoresParaExpedicao(
  params: ListParams = {},
): Promise<PaginatedResult<CondutorExpedicaoRow>> {
  const user = await requireUser();
  // Opção de filtro da listagem: quem só lê (`listar`/`consultar`) também
  // precisa das opções; isto não concede nenhuma mutação.
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.criar",
      "expedicao.alterar",
      "expedicao.listar",
      "expedicao.consultar",
    ]))
  ) {
    return resultadoVazio(params);
  }

  const resultado = await expedicaoDAO.listCondutores(params);
  return {
    ...resultado,
    data: resultado.data.map((condutor) => ({
      id_funcionario: condutor.id_funcionario,
      nome: condutor.pessoaFisica.nome,
    })),
  };
}

/**
 * Destinatários ativos que aparecem em notas de expedições ativas — opções do
 * filtro da listagem. Somente leitura: `listar`/`consultar` também precisam.
 */
export async function listarDestinatariosParaExpedicao(): Promise<
  DestinatarioExpedicaoRow[]
> {
  const user = await requireUser();
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.listar",
      "expedicao.consultar",
    ]))
  ) {
    return [];
  }

  const destinatarios = await expedicaoDAO.listDestinatariosEmExpedicoes();
  return destinatarios.map((destinatario) => ({
    id_destinatario: destinatario.id_destinatario,
    razao_social: destinatario.pessoaJuridica.razao_social,
  }));
}

export async function listarPercursosParaExpedicao(
  params: ListParams = {},
): Promise<PaginatedResult<PercursoExpedicaoRow>> {
  const user = await requireUser();
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.criar",
      "expedicao.alterar",
    ]))
  ) {
    return resultadoVazio(params);
  }

  const resultado = await expedicaoDAO.listPercursos(params);
  return {
    ...resultado,
    data: resultado.data.map((percurso) => ({
      id_percurso: percurso.id_percurso,
      nome: percurso.nome,
      destinatarios: percurso._count.destinatarios,
    })),
  };
}

export type SalvarExpedicaoResultado =
  | { success: true; id_expedicao: number }
  | { error: string };

export async function salvarExpedicao(
  formData: FormData,
): Promise<SalvarExpedicaoResultado> {
  const user = await requireUser();

  const idBruto = formData.get("id_expedicao");
  const id = idBruto ? Number(idBruto) : null;
  if (idBruto && (!Number.isInteger(id) || (id ?? 0) <= 0)) {
    return { error: "Expedição inválida." };
  }

  const permissao = id ? "expedicao.alterar" : "expedicao.criar";
  if (!(await usuarioPode(user, permissao))) {
    return { error: "Sem permissão." };
  }

  const input = {
    data_prevista: formData.get("data_prevista"),
    observacao: formData.get("observacao"),
    id_veiculo: formData.get("id_veiculo"),
    id_funcionario_condutor: formData.get("id_funcionario_condutor"),
    id_percurso: formData.get("id_percurso"),
  };

  const resultado = id
    ? await expedicaoService.alterar(id, input, user.id_usuario)
    : await expedicaoService.criar(input, user.id_usuario);

  if ("error" in resultado) return { error: resultado.error };
  return {
    success: true,
    id_expedicao: resultado.expedicao.id_expedicao,
  };
}

export async function adicionarNotaExpedicao(
  id: number,
  id_nota_saida: number,
) {
  return comPermissao("expedicao.alterar", async (user) => {
    const resultado = await expedicaoService.adicionarNota(
      id,
      id_nota_saida,
      user.id_usuario,
    );
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}

export async function removerNotaExpedicao(
  id: number,
  id_nota_saida: number,
) {
  return comPermissao("expedicao.alterar", async (user) => {
    const resultado = await expedicaoService.removerNota(
      id,
      id_nota_saida,
      user.id_usuario,
    );
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}

export async function moverNotasExpedicao(id: number, ordem: number[]) {
  return comPermissao("expedicao.alterar", async (user) => {
    const resultado = await expedicaoService.moverOrdem(
      id,
      ordem,
      user.id_usuario,
    );
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}

export async function despacharExpedicao(id: number) {
  return comPermissao("expedicao.alterar", async (user) => {
    const resultado = await expedicaoService.despachar(id, user.id_usuario);
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}

/** Fotos da tentativa: até 5, processadas WEBP; os arquivos são limpos em erro. */
async function processarFotosEntrega(
  formData: FormData,
  idExpedicao: number,
  idNotaSaida: number,
): Promise<
  | { fotos: { nome_arquivo: string; url: string; tipo_mime: string }[] }
  | { error: string }
> {
  const arquivos = formData
    .getAll("fotos")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (arquivos.length > 5) {
    return { error: "A tentativa aceita no máximo 5 fotos." };
  }

  const fotos: { nome_arquivo: string; url: string; tipo_mime: string }[] = [];
  const salvas: string[] = [];
  try {
    for (const arquivo of arquivos) {
      const processada = await processarImagemWebp(arquivo);
      if (!processada.ok) {
        for (const url of salvas) await removerImagemAnexo(url);
        return { error: processada.error };
      }
      const url = await salvarImagemAnexo(
        `entregas/${idExpedicao}/${idNotaSaida}`,
        processada.buffer,
        processada.hash,
      );
      salvas.push(url);
      fotos.push({
        nome_arquivo: arquivo.name || "foto.webp",
        url,
        tipo_mime: "image/webp",
      });
    }
    return { fotos };
  } catch (e) {
    for (const url of salvas) await removerImagemAnexo(url);
    return { error: mensagemDeErro(e) };
  }
}

export async function registrarEntregaNota(
  id: number,
  id_nota_saida: number,
  formData: FormData,
) {
  return comPermissao("expedicao.alterar", async (user) => {
    let itens: unknown;
    try {
      itens = JSON.parse(String(formData.get("itens") ?? "[]"));
    } catch {
      return { error: "Itens da entrega inválidos." };
    }

    const fotos = await processarFotosEntrega(formData, id, id_nota_saida);
    if ("error" in fotos) return fotos;

    const resultado = await expedicaoService.registrarEntrega(
      id,
      id_nota_saida,
      {
        itens,
        cortar_restante:
          formData.get("cortar_restante") === "on" ||
          formData.get("cortar_restante") === "true",
        fotos: fotos.fotos,
      },
      user.id_usuario,
    );

    if ("error" in resultado) {
      for (const foto of fotos.fotos) await removerImagemAnexo(foto.url);
      return resultado;
    }
    return { success: true, status: resultado.entrega.status };
  });
}

export async function marcarNotaNaoEntregue(
  id: number,
  id_nota_saida: number,
  formData: FormData,
) {
  return comPermissao("expedicao.alterar", async (user) => {
    const fotos = await processarFotosEntrega(formData, id, id_nota_saida);
    if ("error" in fotos) return fotos;

    const resultado = await expedicaoService.marcarNaoEntregue(
      id,
      id_nota_saida,
      {
        justificativa: formData.get("justificativa"),
        fotos: fotos.fotos,
      },
      user.id_usuario,
    );

    if ("error" in resultado) {
      for (const foto of fotos.fotos) await removerImagemAnexo(foto.url);
      return resultado;
    }
    return { success: true, status: resultado.entrega.status };
  });
}

export async function concluirExpedicao(id: number) {
  return comPermissao("expedicao.alterar", async (user) => {
    const resultado = await expedicaoService.concluir(id, user.id_usuario);
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}

export async function desativarExpedicao(id: number) {
  return comPermissao("expedicao.desativar", async (user) => {
    const resultado = await expedicaoService.desativar(id, user.id_usuario);
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}
