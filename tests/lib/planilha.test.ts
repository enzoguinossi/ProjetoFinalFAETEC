import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";

/** Lê o buffer gerado no formato que o `exceljs` declara aceitar. */
async function lerPlanilha(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(buffer).buffer);
  return workbook;
}

describe("planilha XLSX", () => {
  it("gera aba com cabeçalho, números nativos e células vazias", async () => {
    const buffer = await criarXlsx(
      {
        cabecalho: ["Código", "Quantidade", "Observação"],
        registros: [
          ["000001", 10.5, null],
          ["000002", 3, "Conferido"],
        ],
      },
      { nome: "Teste", nomeArquivo: "teste.xlsx" },
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);

    const workbook = await lerPlanilha(buffer);
    const sheet = workbook.getWorksheet("Teste");
    expect(sheet).toBeDefined();

    expect(sheet!.getCell("A1").value).toBe("Código");
    expect(sheet!.getCell("A1").font?.bold).toBe(true);
    expect(sheet!.getRow(1).height).toBeGreaterThan(0);

    expect(sheet!.getCell("B2").value).toBe(10.5);
    expect(typeof sheet!.getCell("B2").value).toBe("number");
    expect(sheet!.getCell("B2").numFmt).toBe("#,##0.###");
    expect(sheet!.getCell("C2").value).toBeNull();
    expect(sheet!.getCell("A3").value).toBe("000002");
    expect(sheet!.getCell("C3").value).toBe("Conferido");

    expect(sheet!.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet!.autoFilter).toBe("A1:C1");
    expect(sheet!.getColumn(1).width).toBeGreaterThanOrEqual(10);
  });

  it("sanitiza o nome da aba e o limita a 31 caracteres", async () => {
    const nomeLongo = "Relatório [final]: 2026/11 - consolidado semestral";
    const buffer = await criarXlsx(
      { cabecalho: ["A"], registros: [[1]] },
      { nome: nomeLongo, nomeArquivo: "relatorio.xlsx" },
    );

    const workbook = await lerPlanilha(buffer);
    const nome = workbook.worksheets[0]!.name;

    expect(nome).toBe("Relatório final 2026 11 - conso");
    expect(nome.length).toBeLessThanOrEqual(31);
    expect(nome).not.toMatch(/[[\]:*?/\\]/);
  });

  it("responde como download XLSX, sem cache", async () => {
    const buffer = await criarXlsx(
      { cabecalho: ["A"], registros: [["x"]] },
      { nome: "Teste", nomeArquivo: "teste.xlsx" },
    );
    const resposta = respostaXlsx(buffer, "teste.xlsx");

    expect(resposta.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(resposta.headers.get("content-disposition")).toBe(
      'attachment; filename="teste.xlsx"',
    );
    expect(resposta.headers.get("cache-control")).toBe("no-store");
  });
});
