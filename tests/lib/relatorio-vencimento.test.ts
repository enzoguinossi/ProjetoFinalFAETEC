import { describe, expect, it } from "vitest";
import type { ProdutoVencimentoRelatorioRow } from "@/dao/relatorio";
import {
  agruparVencimento,
  classificarVencimento,
} from "@/lib/relatorio-vencimento";

function linha(dias: number, id = dias + 100): ProdutoVencimentoRelatorioRow {
  return {
    id_produto: id,
    codigo: String(id).padStart(6, "0"),
    descricao: `Produto ${id}`,
    quantidade: 1,
    validade: "2026-11-01",
    dias_restantes: dias,
    situacao: "—",
  };
}

describe("classificarVencimento", () => {
  it("classifica os limites das faixas", () => {
    expect(classificarVencimento(-1)).toBe("vencidos");
    expect(classificarVencimento(0)).toBe("hoje");
    expect(classificarVencimento(1)).toBe("ate30");
    expect(classificarVencimento(30)).toBe("ate30");
    expect(classificarVencimento(31)).toBe("d31a60");
    expect(classificarVencimento(60)).toBe("d31a60");
    expect(classificarVencimento(61)).toBe("d61a90");
    expect(classificarVencimento(90)).toBe("d61a90");
    expect(classificarVencimento(91)).toBe("mais90");
  });
});

describe("agruparVencimento", () => {
  it("agrupa na ordem de urgência e mantém as faixas vazias", () => {
    const data = [linha(91), linha(-2), linha(45), linha(0), linha(15)];

    const grupos = agruparVencimento(data);

    expect(grupos.map((grupo) => grupo.id)).toEqual([
      "vencidos",
      "hoje",
      "ate30",
      "d31a60",
      "d61a90",
      "mais90",
    ]);
    expect(grupos.map((grupo) => grupo.itens.map((item) => item.dias_restantes))).toEqual([
      [-2],
      [0],
      [15],
      [45],
      [],
      [91],
    ]);
  });
});
