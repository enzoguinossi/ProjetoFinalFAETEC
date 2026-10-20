/** Tipos compartilhados entre a página, o cliente e as Server Actions de movimentação. */

export type ConversaoUnidadeItem = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
};

export type ProdutoBuscaItem = {
  id_produto: number;
  descricao: string;
};

export type ProdutoEntradaDetalhe = {
  id_produto: number;
  descricao: string;
  id_conversao_padrao: number | null;
  fator_padrao: number | null;
};

export type FornecedorBuscaItem = {
  id_fornecedor: number;
  razao_social: string;
};

export type NotaEntradaListRow = {
  id_nota_entrada: number;
  data: string;
  fornecedor: string;
  itens: number;
  chaves: string[];
  chavesTexto: string;
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
  chaves_acesso?: string[];
  itens: ItemEntradaPayload[];
};

// ── Saída ───────────────────────────────────────────────────────────

export type RemessaNotaRow = {
  id_remessa: number;
  destinatario: string;
  status: string;
  statusLabel: string;
  podeCancelar: boolean;
};

export type NotaSaidaListRow = {
  id_nota_saida: number;
  data: string;
  remessas: number;
  destinatarios: string;
  status: string;
  listaRemessas: RemessaNotaRow[];
};

export type DestinatarioBuscaItem = {
  id_destinatario: number;
  razao_social: string;
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

export type ProdutoSaidaBuscaItem = {
  id_produto: number;
  descricao: string;
  saldo_disponivel: number;
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
