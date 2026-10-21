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
  /** Ids que não devem aparecer (já adicionados na nota/remessa). */
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

export type RemessaNotaRow = {
  id_remessa: number;
  id_destinatario: number;
  destinatario: string;
  /** Quantidade de produtos: linhas de item da remessa. */
  produtos: number;
  status: string;
  statusLabel: string;
  podeCancelar: boolean;
  /** Só remessas em preparação ou prontas para entrega podem ser editadas. */
  podeEditar: boolean;
};

export type NotaSaidaListRow = {
  id_nota_saida: number;
  data: string;
  remessas: number;
  destinatarios: string;
  status: string;
  listaRemessas: RemessaNotaRow[];
};

export type DestinatarioSelecaoRow = {
  id_destinatario: number;
  razao_social: string;
  tipo: string;
};

export type CondutorItem = {
  id_funcionario: number;
  nome: string;
};

export type VeiculoItem = {
  id_veiculo: number;
  placa: string;
  modelo: string | null;
};

export type ItemSaidaPayload = {
  id_produto: number;
  quantidade_solicitada: number;
};

export type RemessaSaidaPayload = {
  id_destinatario: number;
  id_funcionario_condutor?: number | null;
  id_veiculo?: number | null;
  urgente?: boolean;
  observacao?: string | null;
  itens: ItemSaidaPayload[];
};

export type NovaSaidaPayload = {
  observacao?: string | null;
  remessas: RemessaSaidaPayload[];
};

/** Item da edição: com `id_item_remessa` = existente; sem = novo. */
export type ItemRemessaAtualizacaoPayload = ItemSaidaPayload & {
  id_item_remessa?: number | null;
};

export type AtualizacaoRemessaPayload = Omit<RemessaSaidaPayload, "itens"> & {
  itens: ItemRemessaAtualizacaoPayload[];
};

export type AtualizacaoNotaSaidaPayload = {
  observacao?: string | null;
};

export type RemessaItemDetalhe = {
  id_item_remessa: number;
  id_produto: number;
  descricao: string;
  quantidade_solicitada: number;
  quantidade_separada: number | null;
  quantidade_entregue: number | null;
};

/** Remessa carregada para os modais de visualização e edição. */
export type RemessaFormData = {
  id_remessa: number;
  id_nota_saida: number;
  status: string;
  statusLabel: string;
  /** Só remessas em preparação ou prontas para entrega são editáveis. */
  podeEditar: boolean;
  id_destinatario: number;
  destinatario: string;
  id_funcionario_condutor: number | null;
  condutor: string | null;
  id_veiculo: number | null;
  /** Placa e modelo do veículo, quando houver. */
  veiculo: string | null;
  urgente: boolean;
  observacao: string | null;
  itens: RemessaItemDetalhe[];
};

export type NotaSaidaRemessaDetalhe = {
  id_remessa: number;
  destinatario: string;
  status: string;
  statusLabel: string;
  itens: RemessaItemDetalhe[];
};

/** Nota de saída carregada para os modais de visualização e edição. */
export type NotaSaidaFormData = {
  id_nota_saida: number;
  data: string;
  status: string;
  observacao: string | null;
  remessas: NotaSaidaRemessaDetalhe[];
};
