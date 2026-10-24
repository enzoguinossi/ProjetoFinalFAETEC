import {
  relatorioDAO,
  DIAS_VENCIMENTO_RELATORIO,
  ROTULOS_SITUACAO_CADASTRO,
  ROTULOS_STATUS_EXPEDICAO,
  ROTULOS_STATUS_NOTA,
  ROTULOS_TIPO_DESTINATARIO,
  SITUACOES_CADASTRO_RELATORIO,
  SITUACOES_PRODUTO_RELATORIO,
  STATUS_EXPEDICAO_RELATORIO,
  STATUS_NOTA_RELATORIO,
  TIPOS_DESTINATARIO_RELATORIO,
  TIPOS_MOVIMENTACAO_RELATORIO,
  type AuditoriaRelatorioFiltros,
  type AuditoriaRelatorioRow,
  type CondutorFiltroRelatorio,
  type DestinatarioFiltroRelatorio,
  type DestinatarioRelatorioRow,
  type DestinatariosRelatorioResult,
  type DiasVencimentoRelatorio,
  type EntregaRelatorioRow,
  type EntregasRelatorioResult,
  type ExpedicaoFiltroRelatorio,
  type ExpedicaoRelatorioRow,
  type ExpedicoesRelatorioResult,
  type FornecedorFiltroRelatorio,
  type FornecedorRelatorioRow,
  type FornecedoresRelatorioResult,
  type FuncionarioRelatorioRow,
  type FuncionariosRelatorioResult,
  type MovimentacaoRelatorioRow,
  type MovimentacoesRelatorioResult,
  type ProdutoFiltroRelatorio,
  type ProdutoRelatorioRow,
  type ProdutoVencimentoRelatorioRow,
  type ProdutosRelatorioFiltros,
  type ProdutosRelatorioResult,
  type ProdutosVencimentoRelatorioResult,
  type SituacaoCadastroRelatorio,
  type SituacaoProdutoRelatorio,
  type StatusExpedicaoRelatorio,
  type StatusNotaRelatorio,
  type TipoDestinatarioRelatorio,
  type TipoMovimentacaoRelatorio,
  type UsuarioFiltroRelatorio,
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
  /** Produtos selecionados; lista vazia não filtra. */
  id_produtos: number[];
  /** Destinatários selecionados; lista vazia não filtra. */
  id_destinatarios: number[];
  /** Fornecedores selecionados; lista vazia não filtra. */
  id_fornecedores: number[];
  /** Tipos selecionados; lista vazia não filtra (inclui ajustes). */
  tipos: TipoMovimentacaoRelatorio[];
};

export type FiltrosExpedicoes = {
  /** Data inicial de `data_prevista` (`YYYY-MM-DD`). */
  de: string;
  /** Data final de `data_prevista` (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  /** Expedições selecionadas; lista vazia não filtra. */
  id_expedicoes: number[];
  /** Destinatários selecionados; lista vazia não filtra. */
  id_destinatarios: number[];
  /** Condutores selecionados; lista vazia não filtra. */
  id_condutores: number[];
  /** Status selecionados; lista vazia não filtra. */
  status: StatusExpedicaoRelatorio[];
};

export type FiltrosEntregas = {
  /** Data inicial de `nota_saida.data_criacao` (`YYYY-MM-DD`). */
  de: string;
  /** Data final de `nota_saida.data_criacao` (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  /** Destinatários selecionados; lista vazia não filtra. */
  id_destinatarios: number[];
  /** Status da nota selecionados; lista vazia não filtra. */
  status: StatusNotaRelatorio[];
};

/** Filtros do relatório de Auditoria; lista vazia não filtra. */
export type FiltrosAuditoria = {
  /** Data inicial de `registro_auditoria.data_hora` (`YYYY-MM-DD`). */
  de: string;
  /** Data final de `registro_auditoria.data_hora` (`YYYY-MM-DD`), inclusiva. */
  ate: string;
  id_usuarios: number[];
  entidades: string[];
  acoes: string[];
};

/** Filtro do relatório de vencimento: limite em dias ou todos. */
export type FiltrosVencimento = { dias: DiasVencimentoRelatorio };

/** Filtros dos cadastros em multi-seleção; lista vazia não filtra. */
export type FiltrosFuncionarios = { situacoes: SituacaoCadastroRelatorio[] };
export type FiltrosFornecedores = { situacoes: SituacaoCadastroRelatorio[] };
export type FiltrosDestinatarios = FiltrosFuncionarios & {
  tipos: TipoDestinatarioRelatorio[];
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

/** Limite de dias válido; valor desconhecido cai no padrão de 30 dias. */
function diasVencimentoNormalizado(
  valor: string | string[] | null | undefined,
): DiasVencimentoRelatorio {
  const bruto = primeiro(valor).trim();
  if (bruto === "todos") return "todos";
  const numero = Number(bruto);
  const valido = DIAS_VENCIMENTO_RELATORIO.some((dias) => dias === numero);
  return valido ? (numero as DiasVencimentoRelatorio) : 30;
}

/** Normaliza o filtro "Dias para vencer" (30/60/90/120/todos; padrão 30). */
export function normalizarFiltrosVencimento(
  params: { dias?: string | string[] | null } = {},
): FiltrosVencimento {
  return { dias: diasVencimentoNormalizado(params.dias) };
}

/** Normaliza a situação dos cadastros; vazio ou os dois não filtra. */
export function normalizarFiltrosFuncionarios(
  params: { situacao?: string | string[] | null } = {},
): FiltrosFuncionarios {
  return {
    situacoes: opcoesNormalizadas(params.situacao, SITUACOES_CADASTRO_RELATORIO),
  };
}

/** Normaliza situação e tipo dos destinatários (multi; vazio não filtra). */
export function normalizarFiltrosDestinatarios(
  params: {
    situacao?: string | string[] | null;
    tipo?: string | string[] | null;
  } = {},
): FiltrosDestinatarios {
  return {
    situacoes: opcoesNormalizadas(params.situacao, SITUACOES_CADASTRO_RELATORIO),
    tipos: opcoesNormalizadas(params.tipo, TIPOS_DESTINATARIO_RELATORIO),
  };
}

/** Normaliza a situação dos fornecedores (multi; vazio não filtra). */
export function normalizarFiltrosFornecedores(
  params: { situacao?: string | string[] | null } = {},
): FiltrosFornecedores {
  return {
    situacoes: opcoesNormalizadas(params.situacao, SITUACOES_CADASTRO_RELATORIO),
  };
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

/** Dia de hoje em São Paulo como meia-noite UTC — referência do vencimento. */
function hojeUtcSaoPaulo(agora: Date = new Date()): Date {
  return new Date(`${dataSaoPaulo(agora)}T00:00:00.000Z`);
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
 * Quebra um parâmetro de filtro em valores: aceita o parâmetro repetido
 * (`?produto=1&produto=2`) ou uma lista separada por vírgula (`?produto=1,2`).
 */
function listaDeValores(valor: string | string[] | null | undefined): string[] {
  if (valor === null || valor === undefined) return [];
  const partes = Array.isArray(valor) ? valor : [valor];
  return partes
    .flatMap((parte) => parte.split(","))
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0);
}

/** Ids positivos, sem repetição, na ordem em que aparecem. */
function idsNormalizados(valor: string | string[] | null | undefined): number[] {
  const ids = new Set<number>();
  for (const bruto of listaDeValores(valor)) {
    const id = idPositivo(bruto);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

/** Textos livres (entidade/ação) sem repetição; vazio não entra. */
function textosNormalizados(valor: string | string[] | null | undefined): string[] {
  return [...new Set(listaDeValores(valor))];
}

/** Valores aceitos pelo domínio, sem repetição; desconhecidos são ignorados. */
function opcoesNormalizadas<T extends string>(
  valor: string | string[] | null | undefined,
  permitidos: readonly T[],
): T[] {
  const opcoes = new Set<T>();
  for (const bruto of listaDeValores(valor)) {
    if (permitidos.includes(bruto as T)) opcoes.add(bruto as T);
  }
  return [...opcoes];
}

/**
 * Normaliza os filtros da Movimentação de Estoque. Data vazia ou inválida cai
 * no mês corrente (fuso de São Paulo) — `de` no dia 1 e `ate` no último dia.
 * Produto, destinatário, fornecedor e tipo aceitam múltiplos valores (repetidos
 * ou separados por vírgula); lista vazia não filtra.
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

  return {
    de,
    ate,
    id_produtos: idsNormalizados(params.produto),
    id_destinatarios: idsNormalizados(params.destinatario),
    id_fornecedores: idsNormalizados(params.fornecedor),
    tipos: opcoesNormalizadas(params.tipo, TIPOS_MOVIMENTACAO_RELATORIO),
  };
}

/**
 * Normaliza os filtros de Expedições por Período. Data vazia ou inválida cai no
 * mês corrente (fuso de São Paulo). Expedições, destinatários e condutores
 * aceitam múltiplos ids; status aceita múltiplos valores. Lista vazia não filtra.
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

  return {
    de,
    ate,
    id_expedicoes: idsNormalizados(params.expedicao),
    id_destinatarios: idsNormalizados(params.destinatario),
    id_condutores: idsNormalizados(params.condutor),
    status: opcoesNormalizadas(params.status, STATUS_EXPEDICAO_RELATORIO),
  };
}

/**
 * Normaliza os filtros de Entregas por Instituição. Período pelo mês corrente
 * quando vazio/inválido; destinatários e status aceitam múltiplos valores.
 * Lista vazia não filtra.
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

  return {
    de,
    ate,
    id_destinatarios: idsNormalizados(params.destinatario),
    status: opcoesNormalizadas(params.status, STATUS_NOTA_RELATORIO),
  };
}

/**
 * Normaliza os filtros da Auditoria: período em `registro_auditoria.data_hora`
 * (padrão = mês corrente, fuso de São Paulo), usuários por id e entidade/ação
 * por texto. Todos aceitam múltiplos valores (repetidos ou separados por
 * vírgula); lista vazia não filtra.
 */
export function normalizarFiltrosAuditoria(
  params: {
    de?: string | string[] | null;
    ate?: string | string[] | null;
    usuario?: string | string[] | null;
    entidade?: string | string[] | null;
    acao?: string | string[] | null;
  } = {},
  agora: Date = new Date(),
): FiltrosAuditoria {
  const { de: dePadrao, ate: atePadrao } = periodoMesAtual(agora);

  const deBruto = primeiro(params.de).trim();
  const ateBruto = primeiro(params.ate).trim();
  const de = dataValida(deBruto) ? deBruto : dePadrao;
  const ate = dataValida(ateBruto) ? ateBruto : atePadrao;

  return {
    de,
    ate,
    id_usuarios: idsNormalizados(params.usuario),
    entidades: textosNormalizados(params.entidade),
    acoes: textosNormalizados(params.acao),
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

/** Rótulo do status de expedição. */
export function rotuloStatusExpedicao(status: StatusExpedicaoRelatorio): string {
  return ROTULOS_STATUS_EXPEDICAO[status];
}

/** Rótulo do status da nota. */
export function rotuloStatusNota(status: StatusNotaRelatorio): string {
  return ROTULOS_STATUS_NOTA[status];
}

/** Rótulo da situação do cadastro (Ativos/Inativos). */
export function rotuloSituacaoCadastro(situacao: SituacaoCadastroRelatorio): string {
  return ROTULOS_SITUACAO_CADASTRO[situacao];
}

/** Rótulo do tipo de destinatário (Escola/Creche). */
export function rotuloTipoDestinatario(tipo: TipoDestinatarioRelatorio): string {
  return ROTULOS_TIPO_DESTINATARIO[tipo];
}

/** Rótulo do filtro "Dias para vencer": `30 dias` ... ou `Todos`. */
export function rotuloDiasVencimento(dias: DiasVencimentoRelatorio): string {
  return dias === "todos" ? "Todos" : `${dias} dias`;
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

/**
 * CSV de Produtos Próximos ao Vencimento: BOM UTF-8, separador `;` e decimal
 * com vírgula, como nos demais relatórios.
 */
export function gerarCsvVencimento(linhas: ProdutoVencimentoRelatorioRow[]): string {
  const cabecalho = [
    "Código",
    "Produto",
    "Unidade",
    "Quantidade",
    "Validade",
    "Dias restantes",
    "Situação",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    linha.descricao,
    linha.unidade,
    formatarQuantidadeCsv(linha.quantidade),
    formatarDataISO(linha.validade),
    String(linha.dias_restantes),
    linha.situacao,
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/** CSV da lista de Funcionários (RF023/RF024). */
export function gerarCsvFuncionarios(linhas: FuncionarioRelatorioRow[]): string {
  const cabecalho = [
    "Código",
    "Nome",
    "CPF",
    "Cargo",
    "Condutor",
    "Situação",
    "E-mail",
    "Telefone",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    linha.nome,
    linha.cpf ?? "",
    linha.cargo ?? "",
    linha.condutor ? "Sim" : "Não",
    linha.situacao,
    linha.email ?? "",
    linha.telefone ?? "",
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/** CSV da lista de Destinatários (RF023/RF024). */
export function gerarCsvDestinatarios(linhas: DestinatarioRelatorioRow[]): string {
  const cabecalho = [
    "Código",
    "Razão social",
    "CNPJ",
    "Tipo",
    "Situação",
    "Endereço",
    "E-mail",
    "Telefone",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    linha.razao_social,
    linha.cnpj ?? "",
    linha.tipo,
    linha.situacao,
    linha.endereco,
    linha.email ?? "",
    linha.telefone ?? "",
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/** CSV da lista de Fornecedores (RF023/RF024). */
export function gerarCsvFornecedores(linhas: FornecedorRelatorioRow[]): string {
  const cabecalho = [
    "Código",
    "Razão social",
    "CNPJ",
    "Situação",
    "Endereço",
    "E-mail",
    "Telefone",
  ];
  const registros = linhas.map((linha) => [
    linha.codigo,
    linha.razao_social,
    linha.cnpj ?? "",
    linha.situacao,
    linha.endereco,
    linha.email ?? "",
    linha.telefone ?? "",
  ]);
  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(campoCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/**
 * CSV da Auditoria (RF023/RF024), com a mesma formatação pt-BR: BOM UTF-8,
 * separador `;` e decimal com vírgula. A linha traz a data/hora do registro.
 */
export function gerarCsvAuditoria(linhas: AuditoriaRelatorioRow[]): string {
  const cabecalho = ["Data/hora", "Usuário", "Ação", "Entidade", "Registro"];
  const registros = linhas.map((linha) => [
    formatarDataHoraRelatorio(linha.data_hora),
    linha.usuario,
    linha.acao,
    linha.entidade,
    linha.id_entidade_afetada === null ? "—" : String(linha.id_entidade_afetada),
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
      id_produtos: filtros.id_produtos,
      id_destinatarios: filtros.id_destinatarios,
      id_fornecedores: filtros.id_fornecedores,
      tipos: filtros.tipos,
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
      id_expedicoes: filtros.id_expedicoes,
      id_destinatarios: filtros.id_destinatarios,
      id_condutores: filtros.id_condutores,
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
      id_destinatarios: filtros.id_destinatarios,
      status: filtros.status,
    });
    return { ...resultado, filtros };
  }

  /** Produtos perecíveis próximos ao vencimento, com os filtros normalizados. */
  async listarProdutosVencimento(
    params: { dias?: string | string[] | null } = {},
  ): Promise<ProdutosVencimentoRelatorioResult & { filtros: FiltrosVencimento }> {
    const filtros = normalizarFiltrosVencimento(params);
    const resultado = await relatorioDAO.listarProdutosVencimento({
      dias: filtros.dias,
      hoje: hojeUtcSaoPaulo(),
    });
    return { ...resultado, filtros };
  }

  /** Funcionários do cadastro, com a situação selecionada (vazio não filtra). */
  async listarFuncionarios(
    params: { situacao?: string | string[] | null } = {},
  ): Promise<FuncionariosRelatorioResult & { filtros: FiltrosFuncionarios }> {
    const filtros = normalizarFiltrosFuncionarios(params);
    const resultado = await relatorioDAO.listarFuncionariosRelatorio(filtros);
    return { ...resultado, filtros };
  }

  /** Destinatários do cadastro, com situação e tipo selecionados. */
  async listarDestinatarios(
    params: {
      situacao?: string | string[] | null;
      tipo?: string | string[] | null;
    } = {},
  ): Promise<DestinatariosRelatorioResult & { filtros: FiltrosDestinatarios }> {
    const filtros = normalizarFiltrosDestinatarios(params);
    const resultado = await relatorioDAO.listarDestinatariosRelatorio(filtros);
    return { ...resultado, filtros };
  }

  /** Fornecedores do cadastro, com a situação selecionada (vazio não filtra). */
  async listarFornecedores(
    params: { situacao?: string | string[] | null } = {},
  ): Promise<FornecedoresRelatorioResult & { filtros: FiltrosFornecedores }> {
    const filtros = normalizarFiltrosFornecedores(params);
    const resultado = await relatorioDAO.listarFornecedoresRelatorio(filtros);
    return { ...resultado, filtros };
  }

  /**
   * Trilha de auditoria do período, com usuário, entidade e ação em
   * multi-seleção. Os filtros são normalizados e o período vira os instantes
   * UTC do dia local em São Paulo.
   */
  async listarAuditoria(
    params: {
      de?: string | string[] | null;
      ate?: string | string[] | null;
      usuario?: string | string[] | null;
      entidade?: string | string[] | null;
      acao?: string | string[] | null;
    } = {},
  ): Promise<{ data: AuditoriaRelatorioRow[]; total: number; filtros: FiltrosAuditoria }> {
    const filtros = normalizarFiltrosAuditoria(params);
    const { de, ate } = limitesDoPeriodo(filtros);
    const daoFiltros: AuditoriaRelatorioFiltros = {
      de,
      ate,
      id_usuarios: filtros.id_usuarios,
      entidades: filtros.entidades,
      acoes: filtros.acoes,
    };
    const resultado = await relatorioDAO.listarAuditoriaRelatorio(daoFiltros);
    return { ...resultado, filtros };
  }

  /** Opções dos filtros da Auditoria: usuários ativos, entidades e ações. */
  async opcoesFiltroAuditoria(): Promise<{
    usuarios: UsuarioFiltroRelatorio[];
    entidades: string[];
    acoes: string[];
  }> {
    const [usuarios, entidades, acoes] = await Promise.all([
      relatorioDAO.listarUsuariosParaFiltroAuditoria(),
      relatorioDAO.listarEntidadesParaFiltroAuditoria(),
      relatorioDAO.listarAcoesParaFiltroAuditoria(),
    ]);
    return { usuarios, entidades, acoes };
  }

  /** Expedições do período para o filtro (mantém as selecionadas). */
  async expedicoesParaFiltro(
    periodo: { de: string; ate: string },
    incluirIds: number[] = [],
  ): Promise<ExpedicaoFiltroRelatorio[]> {
    const { de, ate } = limitesDoPeriodoData(periodo);
    return relatorioDAO.listarExpedicoesParaFiltro({ de, ate, incluirIds });
  }

  /** Condutores ativos para o filtro (mantém os selecionados). */
  async condutoresParaFiltro(
    incluirIds: number[] = [],
  ): Promise<CondutorFiltroRelatorio[]> {
    return relatorioDAO.listarCondutoresParaFiltro(incluirIds);
  }

  /** Produtos ativos para o filtro (mantém os selecionados, mesmo inativos). */
  async produtosParaFiltro(
    incluirIds: number[] = [],
  ): Promise<ProdutoFiltroRelatorio[]> {
    return relatorioDAO.listarProdutosAtivos(incluirIds);
  }

  /** Destinatários para o filtro (ativos + os selecionados, se inativos). */
  async destinatariosParaFiltro(
    incluirIds: number[] = [],
  ): Promise<DestinatarioFiltroRelatorio[]> {
    return relatorioDAO.listarDestinatariosParaFiltro(incluirIds);
  }

  /** Fornecedores para o filtro (ativos + os selecionados, se inativos). */
  async fornecedoresParaFiltro(
    incluirIds: number[] = [],
  ): Promise<FornecedorFiltroRelatorio[]> {
    return relatorioDAO.listarFornecedoresParaFiltro(incluirIds);
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
