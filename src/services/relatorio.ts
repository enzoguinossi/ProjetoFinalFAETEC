import {
  relatorioDAO,
  SITUACOES_PRODUTO_RELATORIO,
  type ProdutoRelatorioRow,
  type ProdutosRelatorioFiltros,
  type ProdutosRelatorioResult,
  type SituacaoProdutoRelatorio,
} from "@/dao/relatorio";
import { usuarioDAO } from "@/dao/usuario";

const FUSO = "America/Sao_Paulo";

export type EmissaoRelatorio = {
  /** Data da emissão no formato DD/MM/AAAA (fuso America/Sao_Paulo). */
  data: string;
  /** Hora da emissão no formato HH:MM (fuso America/Sao_Paulo). */
  hora: string;
};

/** Lê um parâmetro de query que pode chegar repetido (`?busca=a&busca=b`). */
function primeiro(valor: string | string[] | null | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

/**
 * Normaliza os filtros vindos da tela/CSV. Situação inválida cai no padrão
 * `ativas`; a busca é aparada e vazia não filtra.
 */
export function normalizarFiltrosProdutos(params: {
  busca?: string | string[] | null;
  situacao?: string | string[] | null;
} = {}): Required<ProdutosRelatorioFiltros> {
  const busca = primeiro(params.busca).trim();
  const situacaoBruta = primeiro(params.situacao);
  const situacao: SituacaoProdutoRelatorio = SITUACOES_PRODUTO_RELATORIO.includes(
    situacaoBruta as SituacaoProdutoRelatorio,
  )
    ? (situacaoBruta as SituacaoProdutoRelatorio)
    : "ativas";
  return { busca, situacao };
}

/** Metadados exibidos no cabeçalho do relatório impresso. */
export function metadadosEmissao(agora: Date = new Date()): EmissaoRelatorio {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(agora);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(agora);
  return { data, hora };
}

/** Quantidade no CSV: decimal com vírgula, até 3 casas, sem separador de milhar. */
export function formatarQuantidadeCsv(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

function campoCsv(valor: string): string {
  if (/[";\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/**
 * CSV da Lista de Produtos (RF024): BOM para o Excel pt-BR reconhecer UTF-8,
 * separador `;` e decimal com vírgula.
 */
export function gerarCsvProdutos(linhas: ProdutoRelatorioRow[]): string {
  const cabecalho = [
    "Código",
    "Descrição",
    "Unidade",
    "Quantidade",
    "Qtd. Livre",
    "Situação",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    linha.descricao,
    linha.unidade,
    formatarQuantidadeCsv(linha.quantidade),
    formatarQuantidadeCsv(linha.livre),
    linha.situacao,
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

export class RelatorioService {
  /** Aplica os filtros normalizados e devolve as linhas e os totalizadores. */
  async listarProdutos(params: {
    busca?: string | string[] | null;
    situacao?: string | string[] | null;
  } = {}): Promise<ProdutosRelatorioResult & { filtros: Required<ProdutosRelatorioFiltros> }> {
    const filtros = normalizarFiltrosProdutos(params);
    const resultado = await relatorioDAO.listarProdutosRelatorio(filtros);
    return { ...resultado, filtros };
  }

  /** Nome do usuário emissor exibido no rodapé do relatório. */
  async nomeEmissor(id_usuario: number): Promise<string> {
    const usuario = await usuarioDAO.getById(id_usuario);
    return usuario?.funcionario.pessoaFisica.nome ?? usuario?.login ?? "—";
  }
}

export const relatorioService = new RelatorioService();
