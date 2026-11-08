import { describe, expect, it } from "vitest";
import { produtoParaLinha } from "@/lib/produto-linha";

describe("lib/produto-linha", () => {
  it("usa o saldo e o reservado do produto", () => {
    const linha = produtoParaLinha({
      id_produto: 42,
      descricao: "Arroz",
      saldo: 15,
      saldo_reservado: 5,
      ativo: true,
      composto: false,
    });

    expect(linha).toEqual({
      id_produto: 42,
      codigo: "000042",
      descricao: "Arroz",
      qtd: "15",
      livre: "10",
      ativo: true,
      composto: false,
    });
    expect(linha).not.toHaveProperty("unidade");
  });

  it("mantém qtd. livre negativa quando a reserva excede o saldo (RN001)", () => {
    const linha = produtoParaLinha({
      id_produto: 7,
      descricao: "Feijão",
      saldo: 1,
      saldo_reservado: 4,
      ativo: false,
      composto: true,
    });

    expect(linha.qtd).toBe("1");
    expect(linha.livre).toBe("-3");
    expect(linha.ativo).toBe(false);
    expect(linha.composto).toBe(true);
  });

  it("zera quantidade quando o produto não possui saldo", () => {
    const linha = produtoParaLinha({
      id_produto: 1,
      descricao: "Óleo",
      saldo: 0,
      saldo_reservado: 0,
      ativo: true,
      composto: false,
    });

    expect(linha.qtd).toBe("0");
    expect(linha.livre).toBe("0");
    expect(linha.composto).toBe(false);
  });
});
