// ── Constantes ──────────────────────────────────────────────────────

export const STATUS_NOTA_SAIDA = [
  "ABERTA", "EM_ANDAMENTO", "BAIXA_TOTAL",
  "BAIXA_PARCIAL", "BAIXA_COM_CORTE", "CANCELADA",
] as const;
export type StatusNotaSaida = (typeof STATUS_NOTA_SAIDA)[number];

export const STATUS_REMESSA = [
  "EM_PREPARACAO", "PRONTO_PARA_ENTREGA", "EM_PERCURSO",
  "PENDENTE", "FINALIZADO_TOTAL", "FINALIZADO_PARCIAL", "CANCELADA",
] as const;
export type StatusRemessa = (typeof STATUS_REMESSA)[number];

export const STATUS_ROTA = ["PLANEJADA", "EM_PERCURSO", "CONCLUIDA"] as const;
export type StatusRota = (typeof STATUS_ROTA)[number];

export const STATUS_PEDIDO = ["PENDENTE", "CONFIRMADO", "RECUSADO"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const TIPO_NOTA_SAIDA = [
  "SAIDA", "DESMONTAGEM", "CONSUMO_INTERNO", "AVARIA",
] as const;
export type TipoNotaSaida = (typeof TIPO_NOTA_SAIDA)[number];

export const TIPO_NOTA_ENTRADA = ["ENTRADA", "DESMONTAGEM"] as const;
export type TipoNotaEntrada = (typeof TIPO_NOTA_ENTRADA)[number];

export const TIPO_TELEFONE = ["CELULAR", "FIXO", "COMERCIAL"] as const;
export type TipoTelefone = (typeof TIPO_TELEFONE)[number];

export const TIPO_DESTINATARIO = ["ESCOLA", "CRECHE"] as const;
export type TipoDestinatario = (typeof TIPO_DESTINATARIO)[number];

export const STATUS_VEICULO = ["DISPONIVEL", "INDISPONIVEL", "EM_ROTA"] as const;
export type StatusVeiculo = (typeof STATUS_VEICULO)[number];

export const STATUS_INVENTARIO = [
  "ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO", "FINALIZADO",
] as const;
export type StatusInventario = (typeof STATUS_INVENTARIO)[number];

export const STATUS_AJUSTE = ["PENDENTE", "APROVADO", "REJEITADO"] as const;
export type StatusAjuste = (typeof STATUS_AJUSTE)[number];

// ── Helpers ─────────────────────────────────────────────────────────

export type PermissoesEntidade = {
  canList: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDeactivate: boolean;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type ListParams = PaginationParams & { search?: string };

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function buildPagination(params: PaginationParams): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const take = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * take;
  return { skip, take };
}

export function resultadoVazio<T>(params: PaginationParams = {}): PaginatedResult<T> {
  const { take } = buildPagination(params);
  return { data: [], total: 0, page: Math.max(1, params.page ?? 1), limit: take, totalPages: 0 };
}