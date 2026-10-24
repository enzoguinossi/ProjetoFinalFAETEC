"use server";

import { expedicaoDAO, saldoPendente } from "@/dao/expedicao";
import { expedicaoService } from "@/services/expedicao";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import {
  resultadoVazio,
  type ListParams,
  type PaginatedResult,
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

export type ExpedicaoListRow = {
  id_expedicao: number;
  /** `YYYY-MM-DD`, pronto para exibição. */
  data_prevista: string | null;
  status: string;
  statusLabel: string;
  total_notas: number;
  destinatarios: string;
  veiculo: string | null;
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
};

export type ExpedicaoFormData = {
  id_expedicao: number;
  data_prevista: string | null;
  observacao: string | null;
  id_veiculo: number | null;
  id_funcionario_condutor: number | null;
  veiculo: string | null;
  condutor: string | null;
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
  data_prevista: Date | null;
  status: string;
  veiculo: { placa: string } | null;
  notas: NotaResumo[];
};

type ExpedicaoDetalhe = {
  id_expedicao: number;
  data_prevista: Date | null;
  observacao: string | null;
  id_veiculo: number | null;
  id_funcionario_condutor: number | null;
  status: string;
  ativo: boolean;
  veiculo: { placa: string } | null;
  condutor: { pessoaFisica: { nome: string } } | null;
  notas: {
    id_nota_saida: number;
    ordem_visita: number;
    notaSaida: {
      status: string;
      destinatario: { pessoaJuridica: { razao_social: string } } | null;
      itens: { qtd_esperada: number; qtd_entregue: number }[];
    };
  }[];
};

function dataISO(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
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
    veiculo: expedicao.veiculo?.placa ?? null,
  };
}

function mapaDetalhe(expedicao: ExpedicaoDetalhe): ExpedicaoFormData {
  return {
    id_expedicao: expedicao.id_expedicao,
    data_prevista: dataISO(expedicao.data_prevista),
    observacao: expedicao.observacao,
    id_veiculo: expedicao.id_veiculo,
    id_funcionario_condutor: expedicao.id_funcionario_condutor,
    veiculo: expedicao.veiculo?.placa ?? null,
    condutor: expedicao.condutor?.pessoaFisica.nome ?? null,
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
    })),
  };
}

export async function listarExpedicoes(
  params: ListParams = {},
): Promise<PaginatedResult<ExpedicaoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "expedicao.listar"))) {
    return resultadoVazio(params);
  }

  const resultado = await expedicaoDAO.list(params);
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
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.criar",
      "expedicao.alterar",
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
  if (
    !(await usuarioPodeAlguma(user, [
      "expedicao.criar",
      "expedicao.alterar",
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

export async function desativarExpedicao(id: number) {
  return comPermissao("expedicao.desativar", async (user) => {
    const resultado = await expedicaoService.desativar(id, user.id_usuario);
    if ("error" in resultado) return { error: resultado.error };
    return { success: true };
  });
}
