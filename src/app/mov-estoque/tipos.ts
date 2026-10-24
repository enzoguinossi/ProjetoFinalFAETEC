/** Tipos compartilhados entre a página, o cliente e as Server Actions de movimentação. */

export type ConversaoUnidadeItem = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
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

export type ProdutoEntradaDetalhe = {
  id_produto: number;
  descricao: string;
  id_conversao_padrao: number | null;
  fator_padrao: number | null;
};

export type NotaEntradaListRow = {
  id_nota_entrada: number;
  data: string;
  fornecedor: string;
  itens: number;
  chave_acesso: string | null;
};

export type ItemEntradaPayload = {
  id_produto: number;
  fator_conversao: number;
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
  fator_conversao: number;
  quantidade: number;
  quantidade_convertida: number;
};

/** Nota de entrada carregada para os modos `view` e `edit`. */
export type NotaEntradaFormData = {
  id_nota_entrada: number;
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
  tipo: string;
};

export type ItemSaidaPayload = {
  id_produto: number;
  quantidade_solicitada: number;
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
  /** Unidade de conversão padrão do produto (`UN` quando não houver). */
  unidade: string;
  quantidade_solicitada: number;
  quantidade_entregue: number;
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
  podeCancelar: boolean;
  /** Só notas `ABERTA` (Remessa) podem ser editadas. */
  podeEditar: boolean;
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
  id_destinatario: number | null;
  destinatario: string | null;
  urgente: boolean;
  observacao: string | null;
  itens: NotaSaidaItemDetalhe[];
};
