import { afterEach, describe, expect, it, vi } from "vitest";
import { desmembramentoService } from "@/services/desmembramento";
import { saldoDAO } from "@/dao/estoque";
import { diaUtcSaoPaulo } from "@/lib/datas";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";
import {
  criarEstoque,
  criarInventarioComItem,
  criarProduto,
  criarProdutoInsumo,
  criarUsuario,
} from "../helpers/factories";

/** Composto com um insumo e saldo inicial informado. */
async function prepararComposto(
  opts: { saldo?: number; reservado?: number; quantidadeInsumo?: number } = {},
) {
  const { usuario } = await criarUsuario();
  const pai = await criarProduto({ descricao: "Kit escolar", composto: true });
  const filho = await criarProduto({ descricao: "Borracha" });
  await criarProdutoInsumo(
    pai.id_produto,
    filho.id_produto,
    opts.quantidadeInsumo ?? 2,
  );
  await criarEstoque(pai.id_produto, {
    quantidadeAtual: opts.saldo ?? 10,
    saldoReservado: opts.reservado ?? 0,
  });
  await criarEstoque(filho.id_produto, { quantidadeAtual: 1 });

  return { usuario, pai, filho };
}

describe("desmembramentoService.desmembrar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("baixa o pai e dá entrada nos filhos com as duas notas de desmontagem", async () => {
    const { usuario, pai, filho } = await prepararComposto();

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 2,
      id_usuario: usuario.id_usuario,
    });

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const saida = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: resultado.id_nota_saida },
      include: { itens: true },
    });
    expect(saida).toMatchObject({
      tipo: "DESMONTAGEM",
      status: "BAIXA_TOTAL",
      id_destinatario: null,
      urgente: false,
    });
    expect(saida.observacao).toBe(
      "Desmembramento de 2 unidade(s) de Kit escolar",
    );
    expect(saida.itens).toHaveLength(1);
    expect(saida.itens[0]).toMatchObject({
      id_produto: pai.id_produto,
      qtd_esperada: 2,
      qtd_entregue: 2,
    });

    const entrada = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.id_nota_entrada },
      include: { itens: true },
    });
    expect(entrada).toMatchObject({
      tipo: "DESMONTAGEM",
      id_fornecedor: null,
    });
    expect(entrada.data_recebimento).not.toBeNull();
    // `data_recebimento` é DATE: meia-noite UTC do dia civil de São Paulo.
    expect(entrada.data_recebimento?.toISOString()).toBe(
      diaUtcSaoPaulo(new Date()).toISOString(),
    );
    expect(entrada.itens).toHaveLength(1);
    expect(entrada.itens[0]).toMatchObject({
      id_produto: filho.id_produto,
      quantidade: 4,
    });

    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(8);
    expect(paiDepois.saldo_reservado).toBe(0);

    const filhoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: filho.id_produto },
    });
    expect(filhoDepois.saldo).toBe(5);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      orderBy: { id_movimentacao: "asc" },
    });
    expect(movimentacoes).toHaveLength(2);
    expect(movimentacoes.map((mov) => mov.id_produto).sort()).toEqual(
      [pai.id_produto, filho.id_produto].sort(),
    );

    const movPai = movimentacoes.find((mov) => mov.id_produto === pai.id_produto);
    expect(movPai).toMatchObject({
      id_usuario: usuario.id_usuario,
      quantidade: -2,
      saldo_anterior: 10,
      saldo_posterior: 8,
      id_nota_saida: resultado.id_nota_saida,
    });

    const movFilho = movimentacoes.find(
      (mov) => mov.id_produto === filho.id_produto,
    );
    expect(movFilho).toMatchObject({
      id_usuario: usuario.id_usuario,
      quantidade: 4,
      saldo_anterior: 1,
      saldo_posterior: 5,
      id_nota_entrada: resultado.id_nota_entrada,
    });

    const auditoriaSaida = await auditoriasDe(
      "NotaSaida",
      resultado.id_nota_saida,
    );
    expect(auditoriaSaida).toHaveLength(1);
    expect(auditoriaSaida[0]?.acao).toBe("CRIAR");
    expect(auditoriaSaida[0]?.dados_novos).toMatchObject({
      tipo: "DESMONTAGEM",
      id_nota_entrada: resultado.id_nota_entrada,
      itens: [
        expect.objectContaining({
          id_produto: pai.id_produto,
          quantidade_solicitada: 2,
        }),
      ],
    });

    const auditoriaEntrada = await auditoriasDe(
      "NotaEntrada",
      resultado.id_nota_entrada,
    );
    expect(auditoriaEntrada).toHaveLength(1);
    expect(auditoriaEntrada[0]?.acao).toBe("CRIAR");
    expect(auditoriaEntrada[0]?.dados_novos).toMatchObject({
      tipo: "DESMONTAGEM",
      id_nota_saida: resultado.id_nota_saida,
      itens: [
        expect.objectContaining({
          id_produto: filho.id_produto,
          quantidade: 4,
        }),
      ],
    });
  });

  it("soma insumos repetidos no mesmo item da nota de entrada", async () => {
    const { usuario, pai } = await prepararComposto({ quantidadeInsumo: 2 });
    const filho = await criarProduto({ descricao: "Cola" });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 3);

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 2,
      id_usuario: usuario.id_usuario,
    });
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const entrada = await prismaTeste.notaEntrada.findUniqueOrThrow({
      where: { id_nota_entrada: resultado.id_nota_entrada },
      include: { itens: true },
    });
    expect(entrada.itens).toHaveLength(2);
    expect(
      entrada.itens.find((item) => item.id_produto === filho.id_produto)
        ?.quantidade,
    ).toBe(6);
  });

  it("recusa produto não composto", async () => {
    const { usuario } = await criarUsuario();
    const simples = await criarProduto({ composto: false });

    const resultado = await desmembramentoService.desmembrar({
      id_produto: simples.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect(resultado).toEqual({
      error: "O produto não é composto e não pode ser desmembrado.",
    });
  });

  it("recusa composto sem insumos ativos", async () => {
    const { usuario } = await criarUsuario();
    const pai = await criarProduto({ composto: true });

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect(resultado).toEqual({
      error: "O produto não possui insumos ativos para desmembrar.",
    });
  });

  it("recusa composto com insumo em inventário ativo", async () => {
    const { usuario, pai, filho } = await prepararComposto();
    await criarInventarioComItem(filho.id_produto, usuario.id_usuario);

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect("error" in resultado).toBe(true);
    expect(
      await prismaTeste.notaSaida.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    expect(
      await prismaTeste.notaEntrada.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(10);
  });

  it("recusa composto em inventário ativo", async () => {
    const { usuario, pai } = await prepararComposto();
    await criarInventarioComItem(pai.id_produto, usuario.id_usuario);

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect("error" in resultado).toBe(true);
    expect(
      await prismaTeste.notaSaida.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
  });

  it("RN001: saldo insuficiente apenas avisa e conclui com saldo negativo", async () => {
    const { usuario, pai, filho } = await prepararComposto({
      saldo: 1,
      reservado: 1,
    });

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 2,
      id_usuario: usuario.id_usuario,
    });

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;
    expect(resultado.aviso).toContain("RN001");

    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(-1);
    // A reserva não é tocada pelo desmembramento.
    expect(paiDepois.saldo_reservado).toBe(1);

    const filhoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: filho.id_produto },
    });
    expect(filhoDepois.saldo).toBe(5);
  });

  it("recusa produto pai inativo", async () => {
    const { usuario } = await criarUsuario();
    const pai = await criarProduto({
      descricao: "Kit inativo",
      composto: true,
      ativo: false,
    });
    const filho = await criarProduto({ descricao: "Borracha" });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 2);
    await criarEstoque(pai.id_produto, { quantidadeAtual: 10 });

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect(resultado).toEqual({
      error: "Produto inativo não pode ser desmembrado.",
    });
    expect(
      await prismaTeste.notaSaida.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    expect(
      await prismaTeste.notaEntrada.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
  });

  it("recusa insumo inativo listando os insumos a reativar", async () => {
    const { usuario, pai, filho } = await prepararComposto();
    const insumoInativo = await criarProduto({
      descricao: "Cola",
      ativo: false,
    });
    await criarProdutoInsumo(pai.id_produto, insumoInativo.id_produto, 3);

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 1,
      id_usuario: usuario.id_usuario,
    });

    expect(resultado).toEqual({
      error:
        'Reative o(s) insumo(s) "Cola" ou ajuste o composto antes de desmembrar.',
    });
    expect(
      await prismaTeste.notaSaida.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    expect(
      await prismaTeste.notaEntrada.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);

    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(10);
    const filhoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: filho.id_produto },
    });
    expect(filhoDepois.saldo).toBe(1);
    const inativoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: insumoInativo.id_produto },
    });
    expect(inativoDepois.saldo).toBe(0);
  });

  it.each([0, -1, Number.NaN])(
    "recusa quantidade inválida (%s)",
    async (quantidade) => {
      const { usuario, pai } = await prepararComposto();

      const resultado = await desmembramentoService.desmembrar({
        id_produto: pai.id_produto,
        quantidade,
        id_usuario: usuario.id_usuario,
      });

      expect(resultado).toEqual({
        error: "A quantidade a desmembrar deve ser maior que zero.",
      });
    },
  );

  it("desfaz as notas e os saldos quando uma falha acontece no meio da transação", async () => {
    const { usuario, pai, filho } = await prepararComposto();
    vi.spyOn(saldoDAO, "baixarDireto").mockRejectedValueOnce(
      new Error("falha simulada no meio do desmembramento"),
    );

    const resultado = await desmembramentoService.desmembrar({
      id_produto: pai.id_produto,
      quantidade: 2,
      id_usuario: usuario.id_usuario,
    });

    expect("error" in resultado).toBe(true);
    expect(
      await prismaTeste.notaSaida.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    expect(
      await prismaTeste.notaEntrada.count({ where: { tipo: "DESMONTAGEM" } }),
    ).toBe(0);
    expect(await prismaTeste.movimentacaoEstoque.count()).toBe(0);

    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(10);
    const filhoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: filho.id_produto },
    });
    expect(filhoDepois.saldo).toBe(1);
  });

  it("serializa duas chamadas concorrentes sobre o mesmo composto", async () => {
    const { usuario, pai, filho } = await prepararComposto({
      saldo: 10,
      quantidadeInsumo: 2,
    });

    const [primeira, segunda] = await Promise.all([
      desmembramentoService.desmembrar({
        id_produto: pai.id_produto,
        quantidade: 1,
        id_usuario: usuario.id_usuario,
      }),
      desmembramentoService.desmembrar({
        id_produto: pai.id_produto,
        quantidade: 1,
        id_usuario: usuario.id_usuario,
      }),
    ]);

    expect("error" in primeira).toBe(false);
    expect("error" in segunda).toBe(false);

    const paiDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: pai.id_produto },
    });
    expect(paiDepois.saldo).toBe(8);
    const filhoDepois = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: filho.id_produto },
    });
    expect(filhoDepois.saldo).toBe(5);

    const movimentosPai = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_produto: pai.id_produto },
      orderBy: { id_movimentacao: "asc" },
    });
    expect(movimentosPai).toHaveLength(2);
    // A segunda chamada lê o saldo já baixado pela primeira (10 → 9 → 8).
    expect(
      movimentosPai
        .map((mov) => Number(mov.saldo_anterior))
        .sort((a, b) => a - b),
    ).toEqual([9, 10]);
    expect(
      movimentosPai
        .map((mov) => Number(mov.saldo_posterior))
        .sort((a, b) => a - b),
    ).toEqual([8, 9]);
  });
});
