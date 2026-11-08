// ── Constantes ──────────────────────────────────────────────────────

export const STATUS_NOTA_SAIDA = [
  "ABERTA", "EM_PERCURSO", "PENDENTE",
  "BAIXA_TOTAL", "BAIXA_PARCIAL", "BAIXA_COM_CORTE", "CANCELADA",
] as const;
export type StatusNotaSaida = (typeof STATUS_NOTA_SAIDA)[number];

export const STATUS_EXPEDICAO = ["PLANEJADA", "EM_PERCURSO", "CONCLUIDA"] as const;
export type StatusExpedicao = (typeof STATUS_EXPEDICAO)[number];

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

/** Tipo de escola/destinatário vindo do cadastro editável (`tipo_destinatario`). */
export type TipoDestinatarioItem = {
  id_tipo_destinatario: number;
  codigo: string;
  nome: string;
  padrao: boolean;
  /** Quantidade de destinatários vinculados (usada no modal de tipos). */
  total_destinatarios?: number;
};

export const STATUS_VEICULO = ["DISPONIVEL", "INDISPONIVEL", "EM_EXPEDICAO"] as const;
export type StatusVeiculo = (typeof STATUS_VEICULO)[number];

export const STATUS_INVENTARIO = [
  "ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO", "FINALIZADO", "CANCELADO",
] as const;
export type StatusInventario = (typeof STATUS_INVENTARIO)[number];

export const ORIGEM_AJUSTE = ["MEDIA", "CONTAGEM"] as const;
export type OrigemAjuste = (typeof ORIGEM_AJUSTE)[number];

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

/** Teto de itens por página nas listagens paginadas da UI. */
export const LIMITE_PAGINA_MAX = 100;
/**
 * Teto das listas de opções (chips/seletores). É maior que o da paginação
 * normal; acima dele a opção não é listada — a busca livre do seletor cobre o
 * restante (combobox com busca fica para um próximo run).
 */
export const LIMITE_OPCOES_MAX = 500;

export function buildPagination(
  params: PaginationParams,
  maxLimit: number = LIMITE_PAGINA_MAX,
): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const take = Math.min(Math.max(1, maxLimit), Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * take;
  return { skip, take };
}

export function resultadoVazio<T>(params: PaginationParams = {}): PaginatedResult<T> {
  const { take } = buildPagination(params);
  return { data: [], total: 0, page: Math.max(1, params.page ?? 1), limit: take, totalPages: 0 };
}