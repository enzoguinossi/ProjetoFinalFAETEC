import "server-only";
import ExcelJS from "exceljs";

/** Valor aceito em uma célula: texto, número nativo ou vazio (`null`). */
export type CelulaPlanilha = string | number | null;

/** Conteúdo de uma aba: cabeçalho e linhas na mesma ordem das colunas. */
export type TabelaPlanilha = {
  cabecalho: string[];
  registros: CelulaPlanilha[][];
};

const NOME_ABA_MAX = 31;
const LARGURA_MIN = 10;
const LARGURA_MAX = 60;
const FORMATO_NUMERO = "#,##0.###";
const COR_CABECALHO = "FF334155";

/** Nome de aba aceito pelo Excel: sem `[]:*?/\`, até 31 caracteres. */
function nomeAba(nome: string): string {
  const limpo = nome
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOME_ABA_MAX);
  return limpo || "Planilha";
}

/** Largura pelo maior conteúdo da coluna, entre 10 e 60 caracteres. */
function larguraColuna(cabecalho: string, valores: CelulaPlanilha[]): number {
  let maior = cabecalho.length;
  for (const valor of valores) {
    const tamanho = valor === null ? 0 : String(valor).length;
    if (tamanho > maior) maior = tamanho;
  }
  return Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, maior + 2));
}

/**
 * Gera a planilha XLSX de um relatório: cabeçalho em negrito, linha congelada
 * com filtro, larguras calculadas e números nativos (`#,##0.###`). Strings e
 * datas já formatadas continuam texto; `null` fica vazio.
 */
export async function criarXlsx(
  tabela: TabelaPlanilha,
  opcoes: { nome: string; nomeArquivo: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nexus";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(nomeAba(opcoes.nome));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const linhaCabecalho = worksheet.addRow(tabela.cabecalho);
  linhaCabecalho.height = 22;
  linhaCabecalho.eachCell({ includeEmpty: true }, (celula) => {
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COR_CABECALHO },
    };
    celula.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  for (const registro of tabela.registros) {
    const linha = worksheet.addRow(registro);
    linha.eachCell({ includeEmpty: true }, (celula) => {
      celula.alignment = { vertical: "middle" };
      if (typeof celula.value === "number") celula.numFmt = FORMATO_NUMERO;
    });
  }

  tabela.cabecalho.forEach((titulo, indice) => {
    worksheet.getColumn(indice + 1).width = larguraColuna(
      titulo,
      tabela.registros.map((registro) => registro[indice] ?? null),
    );
  });

  if (tabela.cabecalho.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: tabela.cabecalho.length },
    };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Resposta de download da planilha, com o tipo e o nome do arquivo. */
export function respostaXlsx(buffer: Buffer, nomeArquivo: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
