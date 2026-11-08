/** Tipos compartilhados entre a página, o cliente e as Server Actions de movimentação. */

import type { TipoNotaEntrada } from "@/types";

export type ConversaoUnidadeItem = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
  padrao: boolean;
};

/** Parâmetros das listagens paginadas usadas pelos seletores (modais). */
export type SelecaoParams = {
  page?: number;
  search?: string;
  limit?: number;
  /** Ids que não devem aparecer (já adicionados na nota). */
  excludeIds?: number[];
};

export type FornecedorSelecaoRow = {
  id_fornecedor: number;
  razao_social: string;
  cnpj: string | null;
};

export type ProdutoSaidaDetalhe = {
  id_produto: number;
  descricao: string;
  /** Nome da unidade de saída; null quando a relação não existe (fator 1). */
  unidade_saida: string | null;
  fator: number;
};

export type ProdutoEntradaDetalhe = {
  id_produto: number;
  descricao: string;
  id_conversao_padrao: number;
  fator_padrao: number | null;
};

export type NotaEntradaListRow = {
  id_nota_entrada: number;
  data: string;
  tipo: TipoNotaEntrada;
  tipoLabel: string;
  fornecedor: string;
  itens: number;
  chave_acesso: string | null;
};

export type ItemEntradaPayload = {
  id_produto: number;
  /** Fator auxiliar no item novo; ignorado em item já gravado. */
  fator_conversao?: number;
  quantidade: number;
  observacao?: string | null;
};

export type NovaEntradaPayload = {
  id_fornecedor?: number | null;
  data_recebimento?: string | null;
  observacao?: string | null;
  chave_acesso?: string | null;
  itens: ItemEntradaPayload[];
};

/** Item da edição: com `id_item_nota_entrada` = existente; sem = novo. */
export type ItemEntradaAtualizacaoPayload = ItemEntradaPayload & {
  id_item_nota_entrada?: number | null;
};

export type AtualizacaoEntradaPayload = Omit<NovaEntradaPayload, "itens"> & {
  itens: ItemEntradaAtualizacaoPayload[];
};

export type NotaEntradaItemDetalhe = {
  id_item_nota_entrada: number;
  id_produto: number;
  descricao: string;
  /** Total já convertido do item. */
  quantidade: number;
};

/** Nota de entrada carregada para os modos `view` e `edit`. */
export type NotaEntradaFormData = {
  id_nota_entrada: number;
  tipo: TipoNotaEntrada;
  id_fornecedor: number | null;
  fornecedor: string | null;
  cnpj: string | null;
  /** `YYYY-MM-DD`, como o `<input type="date">` espera. */
  data_recebimento: string | null;
  observacao: string | null;
  chave_acesso: string | null;
  itens: NotaEntradaItemDetalhe[];
};

// ── Saída ───────────────────────────────────────────────────────────

export type DestinatarioSelecaoRow = {
  id_destinatario: number;
  razao_social: string;
  tipo_nome: string | null;
};

export type ItemSaidaPayload = {
  id_produto: number;
  quantidade_solicitada: number;
  /** Total já em base (item importado do pedido): não reconverte. */
  total_base?: boolean;
};

/** Tipos aceitos no formulário de saída (Remessa, Avaria e Consumo Interno). */
export type TipoSaidaPayload = "SAIDA" | "AVARIA" | "CONSUMO_INTERNO";

export type NovaSaidaPayload = {
  tipo: TipoSaidaPayload;
  /** Obrigatório só em Remessa. */
  id_destinatario?: number | null;
  urgente?: boolean;
  observacao?: string | null;
  itens: ItemSaidaPayload[];
};

/** Pedido aprovado disponível para importar na Saída. */
export type PedidoImportacaoRow = {
  id_pedido_escola: number;
  escola: string;
  data: string;
  itens: { descricao: string; quantidade: number }[];
  total: number;
};

export type PedidoImportacaoDetalhe = {
  id_pedido_escola: number;
  id_destinatario: number;
  escola: string;
  observacao: string | null;
  itens: {
    id_produto: number;
    descricao: string;
    quantidade: number;
    observacao: string | null;
  }[];
};

/** Item da edição: com `id_item_nota_saida` = existente; sem = novo. */
export type ItemSaidaAtualizacaoPayload = ItemSaidaPayload & {
  id_item_nota_saida?: number | null;
};

export type AtualizacaoNotaSaidaPayload = {
  id_destinatario: number;
  urgente?: boolean;
  observacao?: string | null;
  itens: ItemSaidaAtualizacaoPayload[];
};

export type NotaSaidaItemDetalhe = {
  id_item_nota_saida: number;
  id_produto: number;
  descricao: string;
  /** Total solicitado (já convertido no lançamento). */
  quantidade_solicitada: number;
  /** Total entregue. */
  quantidade_entregue: number;
  /** Observação do item (vem do pedido na importação). */
  observacao: string | null;
};

/** Expedição em que a nota está vinculada (histórico, mesmo concluída). */
export type NotaSaidaExpedicao = {
  id_expedicao: number;
  status: string;
  statusLabel: string;
};

export type NotaSaidaListRow = {
  id_nota_saida: number;
  data: string;
  tipo: string;
  tipoLabel: string;
  destinatario: string;
  itens: NotaSaidaItemDetalhe[];
  /** Soma de `qtd_esperada` dos itens. */
  quantidade: number;
  status: string;
  statusLabel: string;
  urgente: boolean;
  podeCancelar: boolean;
  /** Só notas `ABERTA` (Remessa) podem ser editadas. */
  podeEditar: boolean;
  /** Remessa em status que ainda aceita retirada direta de itens. */
  podeRetirar: boolean;
  /** Expedições vinculadas, na ordem de adição. */
  expedicoes: NotaSaidaExpedicao[];
};

/** Tentativa de entrega registrada para a nota (somente leitura). */
export type NotaSaidaTentativa = {
  id_expedicao: number;
  data: string | null;
  status: string;
  justificativa: string | null;
  usuario: string | null;
  fotos: { id_anexo: number; nome_arquivo: string; url: string }[];
};

/** Nota de saída carregada para os modais de visualização e edição. */
export type NotaSaidaFormData = {
  id_nota_saida: number;
  data: string;
  tipo: TipoSaidaPayload;
  tipoLabel: string;
  status: string;
  statusLabel: string;
  /** Só notas abertas são editáveis. */
  podeEditar: boolean;
  /** Remessa em status que ainda aceita retirada direta de itens. */
  podeRetirar: boolean;
  /** Expedições vinculadas, na ordem de adição. */
  expedicoes: NotaSaidaExpedicao[];
  id_destinatario: number | null;
  destinatario: string | null;
  tipo_nome: string | null;
  urgente: boolean;
  observacao: string | null;
  itens: NotaSaidaItemDetalhe[];
  /** Tentativas de entrega registradas (histórico somente leitura). */
  tentativas: NotaSaidaTentativa[];
};
