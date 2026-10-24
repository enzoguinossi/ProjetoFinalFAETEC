import {
  relatorioDAO,
  ROTULOS_STATUS_EXPEDICAO,
  ROTULOS_STATUS_NOTA,
  SITUACOES_PRODUTO_RELATORIO,
  STATUS_EXPEDICAO_RELATORIO,
  STATUS_NOTA_RELATORIO,
  TIPOS_MOVIMENTACAO_RELATORIO,
  type CondutorFiltroRelatorio,
  type DestinatarioFiltroRelatorio,
  type EntregaRelatorioRow,
  type EntregasRelatorioResult,
  type ExpedicaoFiltroRelatorio,
  type ExpedicaoRelatorioRow,
  type ExpedicoesRelatorioResult,
  type FornecedorFiltroRelatorio,
  type MovimentacaoRelatorioRow,
  type MovimentacoesRelatorioResult,
  type ProdutoFiltroRelatorio,
  type ProdutoRelatorioRow,
  type ProdutosRelatorioFiltros,
  type ProdutosRelatorioResult,
  type SituacaoProdutoRelatorio,
  type StatusExpedicaoRelatorio,
  type StatusNotaRelatorio,
  type TipoMovimentacaoRelatorio,
} from "@/dao/relatorio";
import { usuarioDAO } from "@/dao/usuario";

const FUSO = "America/Sao_Paulo";
/**
 * São Paulo não tem horário de verão desde 2019: o offset é fixo em UTC-3.
 * Usado para transformar uma data `YYYY-MM-DD` no instante UTC do dia local.
 */
const OFFSET_SAO_PAULO = "-03:00";

export type EmissaoRelatorio = {
  /** Data da emissão no formato DD/MM/AAAA (fuso America/Sao_Paulo). */
  data: string;
  /** Hora da emissão no formato HH:MM (fuso America/Sao_Paulo). */
  hora: string;
};

export type FiltrosMovimentacao = {
  /** Data inicial (`YYYY-MM-DD`). */
  de: string;
  /** Data final (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  id_produto: number | null;
  id_destinatario: number | null;
  id_fornecedor: number | null;
  tipo: TipoMovimentacaoRelatorio;
};

export type FiltrosExpedicoes = {
  /** Data inicial de `data_prevista` (`YYYY-MM-DD`). */
  de: string;
  /** Data final de `data_prevista` (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  id_expedicao: number | null;
  id_destinatario: number | null;
  id_condutor: number | null;
  status: StatusExpedicaoRelatorio;
};

export type FiltrosEntregas = {
  /** Data inicial de `nota_saida.data_criacao` (`YYYY-MM-DD`). */
  de: string;
  /** Data final de `nota_saida.data_criacao` (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  id_destinatario: number | null;
  status: StatusNotaRelatorio;
};

/** Lê um parâmetro de query que pode chegar repetido (`?situacao=ativas&situacao=todas`). */
function primeiro(valor: string | string[] | null | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

/**
 * Normaliza os filtros vindos da tela/CSV. Situação inválida cai no padrão
 * `ativas`.
 */
export function normalizarFiltrosProdutos(params: {
  situacao?: string | string[] | null;
} = {}): Required<ProdutosRelatorioFiltros> {
  const situacaoBruta = primeiro(params.situacao);
  const situacao: SituacaoProdutoRelatorio = SITUACOES_PRODUTO_RELATORIO.includes(
    situacaoBruta as SituacaoProdutoRelatorio,
  )
    ? (situacaoBruta as SituacaoProdutoRelatorio)
    : "ativas";
  return { situacao };
}

/** Data de `agora` no fuso de São Paulo, no formato `YYYY-MM-DD`. */
function dataSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** `true` se o texto é uma data real no formato `YYYY-MM-DD`. */
function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Primeiro e último dia do mês corrente (fuso de São Paulo), `YYYY-MM-DD`. */
export function periodoMesAtual(agora: Date = new Date()): { de: string; ate: string } {
  const [ano, mes] = dataSaoPaulo(agora).split("-").map(Number);
  const mesTexto = String(mes).padStart(2, "0");
  return {
    de: `${ano}-${mesTexto}-01`,
    ate: `${ano}-${mesTexto}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, "0")}`,
  };
}

/**
 * Semestre corrente (fuso de São Paulo): janeiro–junho ou julho–dezembro,
 * conforme o mês. É apenas um recorte de período do mesmo relatório.
 */
export function periodoSemestreAtual(agora: Date = new Date()): { de: string; ate: string } {
  const [ano, mes] = dataSaoPaulo(agora).split("-").map(Number);
  const inicio = mes <= 6 ? 1 : 7;
  const fim = inicio + 5;
  const mesTexto = (valor: number) => String(valor).padStart(2, "0");
  return {
    de: `${ano}-${mesTexto(inicio)}-01`,
    ate: `${ano}-${mesTexto(fim)}-${String(ultimoDiaDoMes(ano, fim)).padStart(2, "0")}`,
  };
}

/** Id de filtro: inteiro positivo ou `null` (vazio/inválido não filtra). */
function idPositivo(bruto: string): number | null {
  const numero = Number(bruto);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Normaliza os filtros da Movimentação de Estoque. Data vazia ou inválida cai
 * no mês corrente (fuso de São Paulo) — `de` no dia 1 e `ate` no último dia.
 * Tipo inválido cai em `todos`; produto, destinatário e fornecedor
 * vazios/inválidos não filtram.
 */
export function normalizarFiltrosMovimentacao(
  params: {
    de?: string | string[] | null;
    ate?: string | string[] | null;
    produto?: string | string[] | null;
    destinatario?: string | string[] | null;
    fornecedor?: string | string[] | null;
    tipo?: string | string[] | null;
  } = {},
  agora: Date = new Date(),
): FiltrosMovimentacao {
  const { de: dePadrao, ate: atePadrao } = periodoMesAtual(agora);

  const deBruto = primeiro(params.de).trim();
  const ateBruto = primeiro(params.ate).trim();
  const de = dataValida(deBruto) ? deBruto : dePadrao;
  const ate = dataValida(ateBruto) ? ateBruto : atePadrao;

  const id_produto = idPositivo(primeiro(params.produto).trim());
  const id_destinatario = idPositivo(primeiro(params.destinatario).trim());
  const id_fornecedor = idPositivo(primeiro(params.fornecedor).trim());

  const tipoBruto = primeiro(params.tipo).trim() as TipoMovimentacaoRelatorio;
  const tipo = TIPOS_MOVIMENTACAO_RELATORIO.includes(tipoBruto) ? tipoBruto : "todos";

  return { de, ate, id_produto, id_destinatario, id_fornecedor, tipo };
}

/**
 * Normaliza os filtros de Expedições por Período. Data vazia ou inválida cai no
 * mês corrente (fuso de São Paulo). Expedição, destinatário e condutor
 * vazios/inválidos não filtram; status inválido cai em `todas`.
 */
export function normalizarFiltrosExpedicoes(
  params: {
    de?: string | string[] | null;
    ate?: string | string[] | null;
    expedicao?: string | string[] | null;
    destinatario?: string | string[] | null;
    condutor?: string | string[] | null;
    status?: string | string[] | null;
  } = {},
  agora: Date = new Date(),
): FiltrosExpedicoes {
  const { de: dePadrao, ate: atePadrao } = periodoMesAtual(agora);

  const deBruto = primeiro(params.de).trim();
  const ateBruto = primeiro(params.ate).trim();
  const de = dataValida(deBruto) ? deBruto : dePadrao;
  const ate = dataValida(ateBruto) ? ateBruto : atePadrao;

  const statusBruto = primeiro(params.status).trim() as StatusExpedicaoRelatorio;
  const status = STATUS_EXPEDICAO_RELATORIO.includes(statusBruto)
    ? statusBruto
    : "todas";

  return {
    de,
    ate,
    id_expedicao: idPositivo(primeiro(params.expedicao).trim()),
    id_destinatario: idPositivo(primeiro(params.destinatario).trim()),
    id_condutor: idPositivo(primeiro(params.condutor).trim()),
    status,
  };
}

/**
 * Normaliza os filtros de Entregas por Instituição. Período pelo mês corrente
 * quando vazio/inválido; destinatário vazio/inválido não filtra; status
 * inválido cai em `todos`.
 */
export function normalizarFiltrosEntregas(
  params: {
    de?: string | string[] | null;
    ate?: string | string[] | null;
    destinatario?: string | string[] | null;
    status?: string | string[] | null;
  } = {},
  agora: Date = new Date(),
): FiltrosEntregas {
  const { de: dePadrao, ate: atePadrao } = periodoMesAtual(agora);

  const deBruto = primeiro(params.de).trim();
  const ateBruto = primeiro(params.ate).trim();
  const de = dataValida(deBruto) ? deBruto : dePadrao;
  const ate = dataValida(ateBruto) ? ateBruto : atePadrao;

  const statusBruto = primeiro(params.status).trim() as StatusNotaRelatorio;
  const status = STATUS_NOTA_RELATORIO.includes(statusBruto) ? statusBruto : "todos";

  return {
    de,
    ate,
    id_destinatario: idPositivo(primeiro(params.destinatario).trim()),
    status,
  };
}

/**
 * Converte o período `YYYY-MM-DD` para os instantes UTC do dia local em São
 * Paulo: o `de` começa às 00:00 e o `ate` termina às 23:59:59.999 (inclusivo).
 */
export function limitesDoPeriodo(filtros: Pick<FiltrosMovimentacao, "de" | "ate">): {
  de: Date;
  ate: Date;
} {
  return {
    de: new Date(`${filtros.de}T00:00:00.000${OFFSET_SAO_PAULO}`),
    ate: new Date(`${filtros.ate}T23:59:59.999${OFFSET_SAO_PAULO}`),
  };
}

/**
 * Limites de uma coluna `DATE` (sem hora, gravada à meia-noite UTC): o `de` e
 * o `ate` são o próprio dia, não o instante de São Paulo usado nos timestamps.
 */
export function limitesDoPeriodoData(filtros: { de: string; ate: string }): {
  de: Date;
  ate: Date;
} {
  return {
    de: new Date(`${filtros.de}T00:00:00.000Z`),
    ate: new Date(`${filtros.ate}T00:00:00.000Z`),
  };
}

/** Data/hora para exibição e CSV: `DD/MM/AAAA HH:MM` no fuso de São Paulo. */
export function formatarDataHoraRelatorio(valor: Date): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(valor);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(valor);
  return `${data} ${hora}`;
}

/** `YYYY-MM-DD` para `DD/MM/AAAA` (sem deslocar o dia por fuso). */
export function formatarDataISO(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Data para exibição e CSV: `DD/MM/AAAA` no fuso de São Paulo. */
export function formatarDataRelatorio(valor: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(valor);
}

/** Rótulo do status de expedição, incluindo `todas` como "Todas". */
export function rotuloStatusExpedicao(status: StatusExpedicaoRelatorio): string {
  return status === "todas" ? "Todas" : ROTULOS_STATUS_EXPEDICAO[status];
}

/** Rótulo do status da nota, incluindo `todos` como "Todos". */
export function rotuloStatusNota(status: StatusNotaRelatorio): string {
  return status === "todos" ? "Todos" : ROTULOS_STATUS_NOTA[status];
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

/**
 * CSV da Movimentação de Estoque (RF023/RF024), com a mesma formatação pt-BR
 * da Lista de Produtos: BOM UTF-8, separador `;` e decimal com vírgula.
 */
export function gerarCsvMovimentacoes(linhas: MovimentacaoRelatorioRow[]): string {
  const cabecalho = [
    "Data",
    "Produto",
    "Tipo",
    "Documento",
    "Destinatário / Fornecedor",
    "Quantidade",
    "Saldo anterior",
    "Saldo posterior",
    "Usuário",
    "Observação",
  ];
  const registros = linhas.map((linha) => [
    formatarDataHoraRelatorio(linha.data_hora),
    `${linha.codigo} - ${linha.produto}`,
    linha.tipo,
    linha.documento,
    linha.destinatario_fornecedor,
    formatarQuantidadeCsv(linha.quantidade),
    linha.saldo_anterior === null ? "—" : formatarQuantidadeCsv(linha.saldo_anterior),
    linha.saldo_posterior === null ? "—" : formatarQuantidadeCsv(linha.saldo_posterior),
    linha.usuario,
    linha.observacao ?? "",
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/**
 * CSV de Expedições por Período (RF023/RF024), com a mesma formatação pt-BR:
 * BOM UTF-8, separador `;` e decimal com vírgula.
 */
export function gerarCsvExpedicoes(linhas: ExpedicaoRelatorioRow[]): string {
  const cabecalho = [
    "Data prevista",
    "Status",
    "Veículo",
    "Condutor",
    "Notas",
    "Destinatários",
    "Itens esperados",
    "Itens entregues",
  ];
  const registros = linhas.map((linha) => [
    formatarDataISO(linha.data_prevista),
    linha.status,
    linha.veiculo,
    linha.condutor,
    String(linha.notas),
    linha.destinatarios,
    formatarQuantidadeCsv(linha.itens_esperados),
    formatarQuantidadeCsv(linha.itens_entregues),
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/**
 * CSV de Entregas por Instituição (RF023/RF024), com a mesma formatação pt-BR
 * dos demais relatórios.
 */
export function gerarCsvEntregas(linhas: EntregaRelatorioRow[]): string {
  const cabecalho = [
    "Nota",
    "Data",
    "Destinatário",
    "Status",
    "Itens",
    "Esperado",
    "Entregue",
    "Pendente",
    "Expedição",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    formatarDataRelatorio(linha.data),
    linha.destinatario,
    linha.status,
    String(linha.itens),
    formatarQuantidadeCsv(linha.esperado),
    formatarQuantidadeCsv(linha.entregue),
    formatarQuantidadeCsv(linha.pendente),
    linha.expedicao,
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

export class RelatorioService {
  /** Aplica os filtros normalizados e devolve as linhas e os totalizadores. */
  async listarProdutos(params: {
    situacao?: string | string[] | null;
  } = {}): Promise<ProdutosRelatorioResult & { filtros: Required<ProdutosRelatorioFiltros> }> {
    const filtros = normalizarFiltrosProdutos(params);
    const resultado = await relatorioDAO.listarProdutosRelatorio(filtros);
    return { ...resultado, filtros };
  }

  /**
   * Movimentações de estoque do período, com os filtros normalizados. Sem
   * produto informado, é o relatório de Movimentação; com produto, o Extrato
   * de Produto (KAN-161). Destinatário e fornecedor filtram o relatório único.
   */
  async listarMovimentacoes(
    params: {
      de?: string | string[] | null;
      ate?: string | string[] | null;
      produto?: string | string[] | null;
      destinatario?: string | string[] | null;
      fornecedor?: string | string[] | null;
      tipo?: string | string[] | null;
    } = {},
  ): Promise<MovimentacoesRelatorioResult & { filtros: FiltrosMovimentacao }> {
    const filtros = normalizarFiltrosMovimentacao(params);
    const { de, ate } = limitesDoPeriodo(filtros);
    const resultado = await relatorioDAO.listarMovimentacoes({
      de,
      ate,
      id_produto: filtros.id_produto,
      id_destinatario: filtros.id_destinatario,
      id_fornecedor: filtros.id_fornecedor,
      tipo: filtros.tipo,
    });
    return { ...resultado, filtros };
  }

  /** Expedições por período, com os filtros normalizados. */
  async listarExpedicoes(
    params: {
      de?: string | string[] | null;
      ate?: string | string[] | null;
      expedicao?: string | string[] | null;
      destinatario?: string | string[] | null;
      condutor?: string | string[] | null;
      status?: string | string[] | null;
    } = {},
  ): Promise<ExpedicoesRelatorioResult & { filtros: FiltrosExpedicoes }> {
    const filtros = normalizarFiltrosExpedicoes(params);
    const { de, ate } = limitesDoPeriodoData(filtros);
    const resultado = await relatorioDAO.listarExpedicoesRelatorio({
      de,
      ate,
      id_expedicao: filtros.id_expedicao,
      id_destinatario: filtros.id_destinatario,
      id_condutor: filtros.id_condutor,
      status: filtros.status,
    });
    return { ...resultado, filtros };
  }

  /** Entregas por instituição, com os filtros normalizados. */
  async listarEntregas(
    params: {
      de?: string | string[] | null;
      ate?: string | string[] | null;
      destinatario?: string | string[] | null;
      status?: string | string[] | null;
    } = {},
  ): Promise<EntregasRelatorioResult & { filtros: FiltrosEntregas }> {
    const filtros = normalizarFiltrosEntregas(params);
    const { de, ate } = limitesDoPeriodo(filtros);
    const resultado = await relatorioDAO.listarEntregasRelatorio({
      de,
      ate,
      id_destinatario: filtros.id_destinatario,
      status: filtros.status,
    });
    return { ...resultado, filtros };
  }

  /** Expedições do período para o select de filtro (mantém a selecionada). */
  async expedicoesParaFiltro(
    periodo: { de: string; ate: string },
    incluirId?: number | null,
  ): Promise<ExpedicaoFiltroRelatorio[]> {
    const { de, ate } = limitesDoPeriodoData(periodo);
    return relatorioDAO.listarExpedicoesParaFiltro({ de, ate, incluirId });
  }

  /** Condutores ativos para o select de filtro (mantém o selecionado). */
  async condutoresParaFiltro(
    incluirId?: number | null,
  ): Promise<CondutorFiltroRelatorio[]> {
    return relatorioDAO.listarCondutoresParaFiltro(incluirId);
  }

  /** Produtos ativos para o select de filtro. */
  async produtosParaFiltro(): Promise<ProdutoFiltroRelatorio[]> {
    return relatorioDAO.listarProdutosAtivos();
  }

  /** Destinatários para o select de filtro (ativos + o selecionado, se inativo). */
  async destinatariosParaFiltro(
    incluirId?: number | null,
  ): Promise<DestinatarioFiltroRelatorio[]> {
    return relatorioDAO.listarDestinatariosParaFiltro(incluirId);
  }

  /** Fornecedores para o select de filtro (ativos + o selecionado, se inativo). */
  async fornecedoresParaFiltro(incluirId?: number | null): Promise<FornecedorFiltroRelatorio[]> {
    return relatorioDAO.listarFornecedoresParaFiltro(incluirId);
  }

  /** Produto do filtro (para o cabeçalho do Extrato de Produto). */
  async produtoParaFiltro(id_produto: number): Promise<ProdutoFiltroRelatorio | null> {
    return relatorioDAO.obterProdutoFiltro(id_produto);
  }

  /** Nome do usuário emissor exibido no rodapé do relatório. */
  async nomeEmissor(id_usuario: number): Promise<string> {
    const usuario = await usuarioDAO.getById(id_usuario);
    return usuario?.funcionario.pessoaFisica.nome ?? usuario?.login ?? "—";
  }
}

export const relatorioService = new RelatorioService();
