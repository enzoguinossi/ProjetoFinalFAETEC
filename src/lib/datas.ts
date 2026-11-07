/**
 * Datas de calendário no fuso de São Paulo.
 *
 * As colunas `DATE` do banco (`data_validade`, `data_entrada`, ...) são gravadas
 * como meia-noite UTC do dia informado. Comparar com `new Date()` direto erra
 * à noite, porque o UTC já virou o dia seguinte; por isso os helpers abaixo
 * reduzem os dois lados ao dia civil de São Paulo antes de calcular diferenças.
 */

export const FUSO_NEXUS = "America/Sao_Paulo";

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const;

const formatadorDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_NEXUS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ano, mês (1-12) e dia civis no fuso de São Paulo. */
export function partesDataSaoPaulo(valor: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = formatadorDia.format(valor).split("-").map(Number);
  return { ano, mes, dia };
}

/** Meia-noite UTC do dia civil de São Paulo — comparável com colunas `DATE`. */
export function diaUtcSaoPaulo(valor: Date): Date {
  const { ano, mes, dia } = partesDataSaoPaulo(valor);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Dias civis entre a validade e a referência (negativo = vencido). */
export function diasAteValidade(validade: Date, referencia: Date = new Date()): number {
  const alvo = new Date(
    Date.UTC(validade.getUTCFullYear(), validade.getUTCMonth(), validade.getUTCDate()),
  );
  return Math.round((alvo.getTime() - diaUtcSaoPaulo(referencia).getTime()) / 86_400_000);
}

/**
 * Fim do dia civil em São Paulo (`23:59:59.000-03:00`) para uma data
 * `YYYY-MM-DD`. Devolve `null` quando a entrada não é uma data válida.
 */
export function fimDoDiaSaoPaulo(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!dia) return null;
  const [, ano, mes, diaMes] = dia;
  const data = new Date(`${ano}-${mes}-${diaMes}T23:59:59-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Limites de um período sobre uma coluna `DATE` (`YYYY-MM-DD`, inclusivo).
 *
 * A coluna guarda a meia-noite UTC do dia informado — mesma convenção de
 * `data_prevista` e `data_inicio` —, então o intervalo usa o próprio dia em
 * UTC. Usar o instante de São Paulo deslocaria o `de` para depois da
 * meia-noite e excluiria o primeiro dia. Entradas inválidas viram `null`.
 */
export function limitesDoDiaUtc(
  de: string | null | undefined,
  ate: string | null | undefined,
): { inicio: Date | null; fim: Date | null } {
  const converter = (valor: string | null | undefined): Date | null => {
    if (!valor) return null;
    const texto = valor.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
    const data = new Date(`${texto}T00:00:00.000Z`);
    if (Number.isNaN(data.getTime())) return null;
    // Rejeita datas normalizadas pelo JS (ex.: 2026-02-31 → 03/03).
    return data.toISOString().slice(0, 10) === texto ? data : null;
  };
  return { inicio: converter(de), fim: converter(ate) };
}

/**
 * Limites de um período sobre uma coluna de instante (`DATETIME`), no dia
 * civil de São Paulo (inclusivo).
 *
 * O início é `00:00:00.000-03:00` e o fim é `23:59:59.999-03:00`, então uma
 * nota criada às 23:30 continua no dia local, mesmo que em UTC já seja o dia
 * seguinte. Entradas inválidas viram `null`.
 */
export function limitesDoDiaSaoPaulo(
  de: string | null | undefined,
  ate: string | null | undefined,
): { inicio: Date | null; fim: Date | null } {
  const converter = (
    valor: string | null | undefined,
    fimDoDia: boolean,
  ): Date | null => {
    if (!valor) return null;
    const texto = valor.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
    const hora = fimDoDia ? "23:59:59.999" : "00:00:00.000";
    const data = new Date(`${texto}T${hora}-03:00`);
    if (Number.isNaN(data.getTime())) return null;
    // Rejeita datas normalizadas pelo JS (ex.: 2026-02-31 → 03/03).
    return diaISOSaoPaulo(data) === texto ? data : null;
  };
  return { inicio: converter(de, false), fim: converter(ate, true) };
}

/** Data `YYYY-MM-DD` do dia civil de São Paulo. */
export function diaISOSaoPaulo(valor: Date): string {
  const { ano, mes, dia } = partesDataSaoPaulo(valor);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Chave `YYYY-MM` do mês civil de São Paulo. */
export function chaveMesSaoPaulo(valor: Date): string {
  const { ano, mes } = partesDataSaoPaulo(valor);
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export type MesReferencia = {
  chave: string;
  label: string;
  /** Primeiro instante do mês (UTC), para filtrar no banco. */
  primeiroDia: Date;
};

/** Últimos `quantidade` meses civis, do mais antigo para o atual. */
export function ultimosMeses(quantidade = 6, referencia: Date = new Date()): MesReferencia[] {
  const { ano, mes } = partesDataSaoPaulo(referencia);
  const meses: MesReferencia[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const primeiroDia = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const mesUtc = primeiroDia.getUTCMonth();
    const anoUtc = primeiroDia.getUTCFullYear();
    meses.push({
      chave: `${anoUtc}-${String(mesUtc + 1).padStart(2, "0")}`,
      label: `${MESES_CURTOS[mesUtc]}/${String(anoUtc).slice(2)}`,
      primeiroDia,
    });
  }
  return meses;
}
