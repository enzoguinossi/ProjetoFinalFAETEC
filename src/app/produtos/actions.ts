"use server";

import { prisma } from "@/lib/prisma";

export type ProdutoListRow = {
  codigo: string;
  descricao: string;
  qtd: string;
  livre: string;
};

export async function searchProdutosList(query: string): Promise<ProdutoListRow[]> {
  if (query.length < 2) return [];

  const take = 50;

  const select = {
    id_produto: true,
    descricao: true,
    estoques: {
      where: { ativo: true },
      select: { quantidade_atual: true, saldo_reservado: true },
    },
  } as const;

  const [exactCode, prefixCode, containCode, containDesc] = await Promise.all([
    prisma.produto.findMany({
      where: {
        ativo: true,
        produtoCodigos: { some: { codigo: { equals: query } } },
      },
      select,
      take,
      orderBy: { descricao: "asc" },
    }),
    prisma.produto.findMany({
      where: {
        ativo: true,
        produtoCodigos: { some: { codigo: { startsWith: query } } },
        NOT: { produtoCodigos: { some: { codigo: { equals: query } } } },
      },
      select,
      take,
      orderBy: { descricao: "asc" },
    }),
    prisma.produto.findMany({
      where: {
        ativo: true,
        produtoCodigos: { some: { codigo: { contains: query } } },
        NOT: {
          OR: [
            { produtoCodigos: { some: { codigo: { equals: query } } } },
            { produtoCodigos: { some: { codigo: { startsWith: query } } } },
          ],
        },
      },
      select,
      take,
      orderBy: { descricao: "asc" },
    }),
    prisma.produto.findMany({
      where: {
        ativo: true,
        descricao: { contains: query },
        NOT: {
          OR: [
            { produtoCodigos: { some: { codigo: { equals: query } } } },
            { produtoCodigos: { some: { codigo: { startsWith: query } } } },
            { produtoCodigos: { some: { codigo: { contains: query } } } },
          ],
        },
      },
      select,
      take,
      orderBy: { descricao: "asc" },
    }),
  ]);

  const seen = new Set<number>();
  const results: ProdutoListRow[] = [];

  function toRow(p: typeof exactCode[number]): ProdutoListRow {
    const qtd = p.estoques.reduce((s, e) => s + Number(e.quantidade_atual), 0);
    const reservado = p.estoques.reduce((s, e) => s + Number(e.saldo_reservado), 0);
    return {
      codigo: String(p.id_produto).padStart(6, "0"),
      descricao: p.descricao,
      qtd: String(qtd),
      livre: String(qtd - reservado),
    };
  }

  for (const batch of [exactCode, prefixCode, containCode, containDesc]) {
    for (const p of batch) {
      if (!seen.has(p.id_produto)) {
        seen.add(p.id_produto);
        results.push(toRow(p));
        if (results.length >= take) break;
      }
    }
    if (results.length >= take) break;
  }

  return results;
}