import { describe, expect, it } from "vitest";
import type {
  MovimentacaoRelatorioRow,
  ProdutoFiltroRelatorio,
} from "@/dao/relatorio";
import {
  agruparExtratoPorProduto,
  agruparPorDocumento,
  produtosComMovimento,
} from "@/lib/relatorio-movimentacao";

/** Linha de movimentação com defaults; o teste sobrescreve o que interessa. */
function linha(
  overrides: Partial<MovimentacaoRelatorioRow> = {},
): MovimentacaoRelatorioRow {
  return {
    id_movimentacao: 1,
    data_hora: new Date("2026-10-01T12:00:00.000Z"),
    id_produto: 1,
    codigo: "000001",
    produto: "Arroz",
    tipo: "Entrada",
    documento: "NE #12",
    destinatario_fornecedor: "Fornecedor A",
    quantidade: 10,
    saldo_anterior: 0,
    saldo_posterior: 10,
    usuario: "Ana",
    observacao: null,
    ...overrides,
  };
}

function produto(
  id: number,
  codigo: string,
  descricao: string,
): ProdutoFiltroRelatorio {
  return { id_produto: id, codigo, descricao };
}

describe("produtosComMovimento", () => {
  it("deduplica produtos repetidos preservando código e descrição", () => {
    const data = [
      linha({ id_movimentacao: 1, id_produto: 2, codigo: "000002", produto: "Feijão" }),
      linha({ id_movimentacao: 2, id_produto: 1, codigo: "000001", produto: "Arroz" }),
      linha({ id_movimentacao: 3, id_produto: 2, codigo: "000002", produto: "Feijão" }),
    ];

    expect(produtosComMovimento(data)).toEqual([
      { id_produto: 2, codigo: "000002", descricao: "Feijão" },
      { id_produto: 1, codigo: "000001", descricao: "Arroz" },
    ]);
  });

  it("devolve lista vazia sem movimentações", () => {
    expect(produtosComMovimento([])).toEqual([]);
  });

  it("alimenta o extrato com todos os produtos do período, ordenados por código", () => {
    const data = [
      linha({
        id_movimentacao: 1,
        id_produto: 2,
        codigo: "000002",
        produto: "Feijão",
        quantidade: 4,
        saldo_anterior: 0,
        saldo_posterior: 4,
      }),
      linha({
        id_movimentacao: 2,
        id_produto: 1,
        codigo: "000001",
        produto: "Arroz",
        quantidade: 10,
        saldo_anterior: 0,
        saldo_posterior: 10,
      }),
      linha({
        id_movimentacao: 3,
        id_produto: 2,
        codigo: "000002",
        produto: "Feijão",
        documento: "NS #7",
        tipo: "Saída",
        quantidade: -1,
        saldo_anterior: 4,
        saldo_posterior: 3,
      }),
    ];

    const grupos = agruparExtratoPorProduto(data, produtosComMovimento(data));

    expect(grupos.map((grupo) => grupo.codigo)).toEqual(["000001", "000002"]);
    expect(grupos[0]).toMatchObject({
      produto: "Arroz",
      saldo_inicial: 0,
      saldo_final: 10,
      entradas: 10,
      saidas: 0,
    });
    expect(grupos[1]).toMatchObject({
      produto: "Feijão",
      saldo_inicial: 0,
      saldo_final: 3,
      entradas: 4,
      saidas: 1,
    });
  });
});

describe("agruparPorDocumento", () => {
  it("agrupa linhas consecutivas por documento e isola os ajustes", () => {
    const data = [
      linha({ id_movimentacao: 1, documento: "NE #12", usuario: "Ana" }),
      linha({ id_movimentacao: 2, documento: "NE #12", usuario: "Ana" }),
      linha({ id_movimentacao: 3, documento: "NE #12", usuario: "Bruno" }),
      linha({
        id_movimentacao: 4,
        documento: "NS #7",
        tipo: "Saída",
        quantidade: -4,
        usuario: "Ana",
        destinatario_fornecedor: "Escola A",
      }),
      linha({
        id_movimentacao: 5,
        documento: "NS #7",
        tipo: "Saída",
        quantidade: -2,
        usuario: "Ana",
        destinatario_fornecedor: "Escola A",
      }),
      linha({
        id_movimentacao: 6,
        documento: "—",
        tipo: "Ajuste",
        destinatario_fornecedor: "—",
        usuario: "Bruno",
      }),
      linha({ id_movimentacao: 7, documento: "NE #12", usuario: "Ana" }),
    ];

    const grupos = agruparPorDocumento(data);

    expect(grupos.map((grupo) => grupo.chave)).toEqual([
      "NE #12",
      "NS #7",
      "ajuste-6",
      "NE #12",
    ]);
    expect(grupos[0]).toMatchObject({
      tipo: "Entrada",
      documento: "NE #12",
      destinatario_fornecedor: "Fornecedor A",
      usuarios: ["Ana", "Bruno"],
    });
    expect(grupos[0]?.itens.map((item) => item.id_movimentacao)).toEqual([1, 2, 3]);
    expect(grupos[1]).toMatchObject({
      tipo: "Saída",
      documento: "NS #7",
      destinatario_fornecedor: "Escola A",
      usuarios: ["Ana"],
    });
    expect(grupos[1]?.itens).toHaveLength(2);
    expect(grupos[2]).toMatchObject({
      chave: "ajuste-6",
      tipo: "Ajuste",
      documento: "—",
      usuarios: ["Bruno"],
    });
    expect(grupos[3]?.itens.map((item) => item.id_movimentacao)).toEqual([7]);
  });

  it("devolve lista vazia sem movimentações", () => {
    expect(agruparPorDocumento([])).toEqual([]);
  });
});

describe("agruparExtratoPorProduto", () => {
  it("ordena por código e inclui produto sem movimento", () => {
    const arroz = produto(1, "000001", "Arroz");
    const feijao = produto(2, "000002", "Feijão");
    const semMovimento = produto(3, "000003", "Sem movimento");
    const acucar = produto(4, "000004", "Açúcar");
    const oleo = produto(5, "000005", "Óleo");
    const nulo = produto(6, "000006", "Sem saldo");

    const data = [
      linha({
        id_movimentacao: 10,
        id_produto: 1,
        codigo: "000001",
        produto: "Arroz",
        quantidade: 10,
        saldo_anterior: 0,
        saldo_posterior: 10,
      }),
      linha({
        id_movimentacao: 11,
        id_produto: 1,
        codigo: "000001",
        produto: "Arroz",
        documento: "NS #7",
        tipo: "Saída",
        quantidade: -3,
        saldo_anterior: 10,
        saldo_posterior: 7,
      }),
      linha({
        id_movimentacao: 12,
        id_produto: 2,
        codigo: "000002",
        produto: "Feijão",
        quantidade: 4,
        saldo_anterior: null,
        saldo_posterior: 4,
      }),
      linha({
        id_movimentacao: 13,
        id_produto: 4,
        codigo: "000004",
        produto: "Açúcar",
        quantidade: 2,
        saldo_anterior: 5,
        saldo_posterior: 7,
      }),
      linha({
        id_movimentacao: 14,
        id_produto: 4,
        codigo: "000004",
        produto: "Açúcar",
        documento: "NS #8",
        tipo: "Saída",
        quantidade: -0.1,
        saldo_anterior: 7,
        saldo_posterior: null,
      }),
      linha({
        id_movimentacao: 15,
        id_produto: 5,
        codigo: "000005",
        produto: "Óleo",
        quantidade: 0.1,
        saldo_anterior: 0,
        saldo_posterior: 0.1,
      }),
      linha({
        id_movimentacao: 16,
        id_produto: 5,
        codigo: "000005",
        produto: "Óleo",
        quantidade: 0.2,
        saldo_anterior: 0.1,
        saldo_posterior: 0.3,
      }),
      linha({
        id_movimentacao: 17,
        id_produto: 6,
        codigo: "000006",
        produto: "Sem saldo",
        quantidade: 1,
        saldo_anterior: null,
        saldo_posterior: null,
      }),
      // Fora da seleção: não pode entrar em nenhum grupo.
      linha({
        id_movimentacao: 99,
        id_produto: 99,
        codigo: "000099",
        produto: "Não selecionado",
        quantidade: 100,
      }),
    ];

    const grupos = agruparExtratoPorProduto(data, [
      acucar,
      feijao,
      arroz,
      oleo,
      semMovimento,
      nulo,
    ]);

    expect(grupos.map((grupo) => grupo.codigo)).toEqual([
      "000001",
      "000002",
      "000003",
      "000004",
      "000005",
      "000006",
    ]);
    expect(grupos[0]).toMatchObject({
      produto: "Arroz",
      saldo_inicial: 0,
      saldo_final: 7,
      entradas: 10,
      saidas: 3,
    });
    expect(grupos[1]).toMatchObject({
      produto: "Feijão",
      saldo_inicial: 0,
      saldo_final: 4,
      entradas: 4,
      saidas: 0,
    });
    expect(grupos[2]).toMatchObject({
      produto: "Sem movimento",
      saldo_inicial: null,
      saldo_final: null,
      entradas: 0,
      saidas: 0,
      itens: [],
    });
    expect(grupos[3]).toMatchObject({
      produto: "Açúcar",
      saldo_inicial: 5,
      saldo_final: 6.9,
      entradas: 2,
      saidas: 0.1,
    });
    expect(grupos[4]).toMatchObject({
      produto: "Óleo",
      entradas: 0.3,
      saidas: 0,
    });
    expect(grupos[5]).toMatchObject({
      produto: "Sem saldo",
      saldo_inicial: null,
      saldo_final: null,
    });

    const ids = grupos.flatMap((grupo) =>
      grupo.itens.map((item) => item.id_movimentacao),
    );
    expect(ids).not.toContain(99);
  });

  it("devolve lista vazia sem produtos selecionados", () => {
    expect(agruparExtratoPorProduto([linha()], [])).toEqual([]);
  });

  it("calcula saldo inicial pelo saldo posterior e final pelo anterior", () => {
    const item = produto(1, "000001", "Arroz");
    const grupos = agruparExtratoPorProduto(
      [
        linha({
          id_movimentacao: 1,
          quantidade: 2.5,
          saldo_anterior: null,
          saldo_posterior: 12.5,
        }),
        linha({
          id_movimentacao: 2,
          quantidade: -1.25,
          saldo_anterior: 12.5,
          saldo_posterior: null,
        }),
      ],
      [item],
    );

    expect(grupos[0]).toMatchObject({
      saldo_inicial: 10,
      saldo_final: 11.25,
      entradas: 2.5,
      saidas: 1.25,
    });
  });
});
