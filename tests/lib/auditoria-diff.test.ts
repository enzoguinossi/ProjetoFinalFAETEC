import { describe, expect, it } from "vitest";
import {
  diffAuditoria,
  type ReferenciasAuditoria,
} from "@/lib/auditoria-diff";

const semReferencias: ReferenciasAuditoria = new Map();

describe("diffAuditoria", () => {
  it("mostra campos simples alterados com rótulos e status", () => {
    const diff = diffAuditoria(
      { nome: "Arroz", status: "ABERTA", ativo: true },
      { nome: "Arroz Integral", status: "CONCLUIDA", ativo: false },
      semReferencias,
    );

    expect(diff).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Nome",
        antes: "Arroz",
        depois: "Arroz Integral",
      },
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Situação",
        antes: "Aberta",
        depois: "Concluída",
      },
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Ativo",
        antes: "Sim",
        depois: "Não",
      },
    ]);
  });

  it("formata datas ISO de dia e de data/hora", () => {
    const diff = diffAuditoria(
      {
        data_prevista: "2026-10-05",
        data_hora: "2026-10-24T15:30:00.000Z",
      },
      {
        data_prevista: "2026-10-06",
        data_hora: "2026-10-24T16:45:00.000Z",
      },
      semReferencias,
    );

    expect(diff.map((campo) => [campo.campo, campo.antes, campo.depois])).toEqual([
      ["Data prevista", "05/10/2026", "06/10/2026"],
      ["Data/hora", "24/10/2026 12:30", "24/10/2026 13:45"],
    ]);
  });

  it("mostra criação e exclusão com — no lado ausente", () => {
    expect(diffAuditoria(null, { nome: "Ana" }, semReferencias)).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Nome",
        antes: "—",
        depois: "Ana",
      },
    ]);
    expect(diffAuditoria({ nome: "Ana" }, null, semReferencias)).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Nome",
        antes: "Ana",
        depois: "—",
      },
    ]);
  });

  it("achata objetos aninhados usando rótulos de campo", () => {
    const diff = diffAuditoria(
      { endereco: { cidade: "Rio de Janeiro", uf: "RJ" } },
      { endereco: { cidade: "Niterói", uf: "RJ" } },
      semReferencias,
    );

    expect(diff).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Cidade",
        antes: "Rio de Janeiro",
        depois: "Niterói",
      },
    ]);
  });

  it("trata array de primitivas como texto, sem JSON", () => {
    const diff = diffAuditoria(
      { tags: ["a", "b"] },
      { tags: ["a", "b", "c"] },
      semReferencias,
    );

    expect(diff[0]).toMatchObject({
      campo: "Tags",
      antes: "a, b",
      depois: "a, b, c",
    });
  });

  it("estrutura coleção por item, com situação e referência", () => {
    const referencias = new Map([["item_nota_saida:34", "Lápis de cor"]]);
    const diff = diffAuditoria(
      {
        itens: [
          { id_item_nota_saida: 34, qtd_esperada: 10, qtd_entregue: 0 },
          { id_item_nota_saida: 35, qtd_esperada: 5, qtd_entregue: 5 },
        ],
      },
      {
        itens: [
          { id_item_nota_saida: 34, qtd_esperada: 10, qtd_entregue: 4 },
          { id_item_nota_saida: 36, qtd_esperada: 2, qtd_entregue: 0 },
        ],
      },
      referencias,
    );

    expect(diff).toEqual([
      {
        grupo: "Itens",
        item: "Item #34 · Lápis de cor",
        situacao: "alterado",
        campo: "Qtd. entregue",
        antes: "0",
        depois: "4",
      },
      {
        grupo: "Itens",
        item: "Item #35",
        situacao: "removido",
        campo: "Qtd. esperada",
        antes: "5",
        depois: "—",
      },
      {
        grupo: "Itens",
        item: "Item #35",
        situacao: "removido",
        campo: "Qtd. entregue",
        antes: "5",
        depois: "—",
      },
      {
        grupo: "Itens",
        item: "Item #36",
        situacao: "novo",
        campo: "Qtd. esperada",
        antes: "—",
        depois: "2",
      },
      {
        grupo: "Itens",
        item: "Item #36",
        situacao: "novo",
        campo: "Qtd. entregue",
        antes: "—",
        depois: "0",
      },
    ]);
  });

  it("usa a chave da coleção de saldos e a referência do produto", () => {
    const referencias = new Map([["produto:9", "Lápis de cor"]]);
    const diff = diffAuditoria(
      { saldos: [{ id_produto: 9, quantidade: 5 }] },
      { saldos: [{ id_produto: 9, quantidade: 7 }] },
      referencias,
    );

    expect(diff).toEqual([
      {
        grupo: "Saldos",
        item: "Produto #9 · Lápis de cor",
        situacao: "alterado",
        campo: "Quantidade",
        antes: "5",
        depois: "7",
      },
    ]);
  });

  it("resolve campos id_* por referência e usa #id quando falta", () => {
    const referencias = new Map([["produto:9", "Lápis de cor"]]);
    expect(diffAuditoria({ id_produto: 9 }, { id_produto: 10 }, referencias)).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Produto",
        antes: "Lápis de cor",
        depois: "#10",
      },
    ]);
  });

  it("resolve id_* aninhado pelo último segmento do caminho", () => {
    const referencias = new Map([["usuario:1", "Enzo Guinossi"]]);
    const diff = diffAuditoria(
      { tentativa: { id_usuario_tentativa: null } },
      { tentativa: { id_usuario_tentativa: 1 } },
      referencias,
    );

    expect(diff).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Usuário da tentativa",
        antes: "—",
        depois: "Enzo Guinossi",
      },
    ]);
  });

  it("trata array vazio como — e descarta — → —", () => {
    expect(diffAuditoria({}, { reservas_liberadas: [] }, semReferencias)).toEqual([]);
    expect(
      diffAuditoria(
        { reservas_liberadas: [] },
        { reservas_liberadas: ["R1"] },
        semReferencias,
      )[0],
    ).toMatchObject({ campo: "Reservas liberadas", antes: "—", depois: "R1" });
  });

  it("redige campos sensíveis e trata ausência", () => {
    expect(
      diffAuditoria({ senha_hash: "a" }, { senha_hash: "b" }, semReferencias),
    ).toEqual([
      {
        grupo: null,
        item: null,
        situacao: null,
        campo: "Senha",
        antes: "[oculto]",
        depois: "[oculto]",
      },
    ]);
    expect(diffAuditoria(null, { senha: "x" }, semReferencias)[0]).toMatchObject({
      campo: "Senha",
      antes: "—",
      depois: "[oculto]",
    });
    expect(diffAuditoria({ senha: "x" }, null, semReferencias)[0]).toMatchObject({
      campo: "Senha",
      antes: "[oculto]",
      depois: "—",
    });
  });

  it("omite campo sensível inalterado", () => {
    expect(
      diffAuditoria(
        { senha: "mesma", nome: "Ana" },
        { senha: "mesma", nome: "Bruno" },
        semReferencias,
      ).map((campo) => campo.campo),
    ).toEqual(["Nome"]);
  });

  it("devolve lista vazia sem mudança e com ambos os snapshots nulos", () => {
    expect(
      diffAuditoria({ nome: "Ana" }, { nome: "Ana" }, semReferencias),
    ).toEqual([]);
    expect(diffAuditoria(null, null, semReferencias)).toEqual([]);
    expect(diffAuditoria(undefined, undefined, semReferencias)).toEqual([]);
  });

  it("trunca textos longos em 120 caracteres", () => {
    const longo = "x".repeat(200);
    const [alteracao] = diffAuditoria(
      { observacao: longo },
      { observacao: "curto" },
      semReferencias,
    );

    expect(alteracao?.antes).toHaveLength(120);
    expect(alteracao?.antes.endsWith("…")).toBe(true);
    expect(alteracao?.depois).toBe("curto");
  });
});
