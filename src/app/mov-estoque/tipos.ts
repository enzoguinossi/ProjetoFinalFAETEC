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
