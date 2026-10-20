import { describe, expect, it } from "vitest";
import { produtoParaLinha } from "@/lib/produto-linha";

describe("lib/produto-linha", () => {
  it("calcula quantidade e qtd. livre somando os estoques ativos", () => {
    const linha = produtoParaLinha({
      id_produto: 42,
      descricao: "Arroz",
      estoques: [
        { quantidade_atual: 10, saldo_reservado: 3 },
        { quantidade_atual: 5, saldo_reservado: 2 },
      ],
    });

    expect(linha).toEqual({
      id_produto: 42,
      codigo: "000042",
      descricao: "Arroz",
      qtd: "15",
      livre: "10",
    });
  });

  it("mantém qtd. livre negativa quando a reserva excede o estoque (RN001)", () => {
    const linha = produtoParaLinha({
      id_produto: 7,
      descricao: "Feijão",
      estoques: [{ quantidade_atual: 1, saldo_reservado: 4 }],
    });

    expect(linha.qtd).toBe("1");
    expect(linha.livre).toBe("-3");
  });

  it("zera quantidade quando o produto não possui estoque", () => {
    const linha = produtoParaLinha({ id_produto: 1, descricao: "Óleo", estoques: [] });

    expect(linha.qtd).toBe("0");
    expect(linha.livre).toBe("0");
  });
});
