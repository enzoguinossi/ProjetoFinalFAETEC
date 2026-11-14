import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { ordenarPor } from "@/lib/ordenacao";
import {
  compararValores,
  paramsDeOrdenacao,
  proximaOrdenacao,
} from "@/lib/ordenacao-tabela";

describe("ordenarPor", () => {
  const mapa: Record<string, Prisma.ProdutoOrderByWithRelationInput> = {
    descricao: { descricao: "asc" },
    tipo: { tipoProduto: { nome: "asc" } },
    qtd: { saldo: "asc" },
  };
  const padrao: Prisma.ProdutoOrderByWithRelationInput = { descricao: "asc" };

  it("aplica a direção pedida no campo da whitelist", () => {
    expect(ordenarPor({ sort: "descricao", dir: "desc" }, mapa, padrao)).toEqual({
      descricao: "desc",
    });
  });

  it("usa asc quando a direção não é informada", () => {
    expect(ordenarPor({ sort: "qtd" }, mapa, padrao)).toEqual({ saldo: "asc" });
  });

  it("troca as folhas de objetos aninhados", () => {
    expect(ordenarPor({ sort: "tipo", dir: "desc" }, mapa, padrao)).toEqual({
      tipoProduto: { nome: "desc" },
    });
  });

  it("percorre arrays aninhados", () => {
    const mapaArray: Record<string, unknown> = {
      nome: { OR: [{ nome: "asc" }, { descricao: "asc" }] },
    };

    expect(
      ordenarPor<unknown>({ sort: "nome", dir: "desc" }, mapaArray, {}),
    ).toEqual({
      OR: [{ nome: "desc" }, { descricao: "desc" }],
    });
  });

  it("volta ao padrão para campo fora da whitelist", () => {
    expect(ordenarPor({ sort: "campo_invalido", dir: "desc" }, mapa, padrao)).toEqual(
      padrao,
    );
    expect(ordenarPor({ sort: "constructor", dir: "desc" }, mapa, padrao)).toEqual(
      padrao,
    );
    expect(ordenarPor({ sort: "__proto__", dir: "desc" }, mapa, padrao)).toEqual(
      padrao,
    );
    expect(ordenarPor({}, mapa, padrao)).toEqual(padrao);
  });
});

describe("proximaOrdenacao", () => {
  it("começa em asc ao ordenar uma coluna nova", () => {
    expect(proximaOrdenacao(null, "descricao")).toEqual({
      campo: "descricao",
      direcao: "asc",
    });
    expect(
      proximaOrdenacao({ campo: "tipo", direcao: "desc" }, "descricao"),
    ).toEqual({ campo: "descricao", direcao: "asc" });
  });

  it("alterna asc → desc → sem ordenação", () => {
    expect(
      proximaOrdenacao({ campo: "descricao", direcao: "asc" }, "descricao"),
    ).toEqual({ campo: "descricao", direcao: "desc" });
    expect(
      proximaOrdenacao({ campo: "descricao", direcao: "desc" }, "descricao"),
    ).toBeNull();
  });
});

describe("compararValores", () => {
  it("compara números por subtração", () => {
    expect(compararValores(2, 10)).toBeLessThan(0);
    expect(compararValores(10, 2)).toBeGreaterThan(0);
    expect(compararValores(5, 5)).toBe(0);
  });

  it("compara strings em pt-BR, numéricas e sem diferenciar caixa", () => {
    expect(compararValores("Produto 2", "Produto 10")).toBeLessThan(0);
    expect(compararValores("ARROZ", "arroz")).toBe(0);
  });

  it("compara datas por timestamp", () => {
    expect(
      compararValores(new Date("2026-01-01"), new Date("2026-02-01")),
    ).toBeLessThan(0);
  });

  it("deixa nulos por último", () => {
    expect(compararValores(null, "a")).toBeGreaterThan(0);
    expect(compararValores("a", null)).toBeLessThan(0);
    expect(compararValores(undefined, 1)).toBeGreaterThan(0);
    expect(compararValores(undefined, null)).toBe(0);
  });
});

describe("paramsDeOrdenacao", () => {
  it("devolve vazio sem ordenação e sort/dir quando há", () => {
    expect(paramsDeOrdenacao(null)).toEqual({});
    expect(paramsDeOrdenacao({ campo: "qtd", direcao: "desc" })).toEqual({
      sort: "qtd",
      dir: "desc",
    });
  });
});
