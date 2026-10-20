import { describe, expect, it } from "vitest";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { notaSaidaService } from "@/services/nota-saida";
import {
  criarDestinatario,
  criarEstoque,
  criarFuncionario,
  criarProduto,
  criarUsuario,
  criarVeiculo,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("notaSaidaService.registrar", () => {
  it("grava uma nota com duas remessas e itens, sem item_nota_saida", async () => {
    const { usuario } = await criarUsuario();
    const produtoA = await criarProduto();
    const produtoB = await criarProduto();
    const { destinatario: destinatarioA } = await criarDestinatario();
    const { destinatario: destinatarioB } = await criarDestinatario();
    const { funcionario: condutor } = await criarFuncionario({ condutor: true });
    const veiculo = await criarVeiculo();

    const resultado = await notaSaidaService.registrar(
      {
        observacao: "Saída de teste",
        remessas: [
          {
            id_destinatario: destinatarioA.id_destinatario,
            id_funcionario_condutor: condutor.id_funcionario,
            id_veiculo: veiculo.id_veiculo,
            urgente: true,
            observacao: "Primeira remessa",
            itens: [{ id_produto: produtoA.id_produto, quantidade_solicitada: 3 }],
          },
          {
            id_destinatario: destinatarioB.id_destinatario,
            itens: [
              { id_produto: produtoA.id_produto, quantidade_solicitada: 2 },
              { id_produto: produtoB.id_produto, quantidade_solicitada: 7 },
            ],
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: resultado.nota.id_nota_saida },
      include: { remessas: { include: { itens: true } } },
    });
    expect(nota.tipo).toBe("SAIDA");
    expect(nota.status).toBe("ABERTA");
    expect(nota.observacao).toBe("Saída de teste");
    expect(nota.remessas).toHaveLength(2);
    expect(nota.remessas.every((r) => r.status === "EM_PREPARACAO")).toBe(true);

    const [primeira, segunda] = nota.remessas.sort((a, b) => a.id_remessa - b.id_remessa);
    expect(primeira?.id_destinatario).toBe(destinatarioA.id_destinatario);
    expect(primeira?.id_funcionario_condutor).toBe(condutor.id_funcionario);
    expect(primeira?.id_veiculo).toBe(veiculo.id_veiculo);
    expect(primeira?.urgente).toBe(true);
    expect(primeira?.observacao).toBe("Primeira remessa");
    expect(primeira?.itens).toHaveLength(1);
    expect(segunda?.id_destinatario).toBe(destinatarioB.id_destinatario);
    expect(segunda?.urgente).toBe(false);
    expect(segunda?.itens).toHaveLength(2);

    expect(await prismaTeste.itemNotaSaida.count()).toBe(0);
    expect(await prismaTeste.itemRemessa.count()).toBe(3);
    expect(await prismaTeste.reservaEstoque.count()).toBe(3);

    const auditorias = await auditoriasDe("NotaSaida", nota.id_nota_saida);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.acao).toBe("CRIAR");
    expect(auditorias[0]?.id_usuario).toBe(usuario.id_usuario);
  });

  it("reserva a quantidade_solicitada na remessa com saldo anterior e posterior", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 10,
      saldoReservado: 2,
    });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 3 }],
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);
    if ("error" in resultado) return;

    const remessa = await prismaTeste.remessa.findUniqueOrThrow({
      where: { id_remessa: resultado.remessas[0]!.id_remessa },
      include: { itens: true, reservas: true },
    });
    expect(remessa.itens).toHaveLength(1);
    expect(remessa.itens[0]).toMatchObject({
      id_estoque: estoque.id_estoque,
      quantidade_solicitada: 3,
    });

    expect(remessa.reservas).toHaveLength(1);
    expect(remessa.reservas[0]).toMatchObject({
      id_estoque: estoque.id_estoque,
      id_remessa: remessa.id_remessa,
      id_usuario: usuario.id_usuario,
      quantidade: 3,
      saldo_anterior: 2,
      saldo_posterior: 5,
    });

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(estoqueApos.quantidade_atual).toBe(10);
  });

  it("RN001: grava mesmo com a quantidade acima do saldo disponível", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, { quantidadeAtual: 2 });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 5 }],
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(false);
    expect(await prismaTeste.notaSaida.count()).toBe(1);

    const estoqueApos = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: estoque.id_estoque },
    });
    expect(estoqueApos.saldo_reservado).toBe(5);
    expect(Number(estoqueApos.quantidade_atual) - Number(estoqueApos.saldo_reservado)).toBe(-3);
  });

  it("cria a linha de estoque com quantidade_atual 0 quando o produto não tem estoque", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 4 }],
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const linhas = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ quantidade_atual: 0, saldo_reservado: 4, ativo: true });
  });

  it("reativa a linha inativa do produto em vez de criar outra", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const inativa = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 8,
      ativo: false,
    });
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
          },
        ],
      },
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const linhas = await prismaTeste.estoque.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id_estoque: inativa.id_estoque,
      ativo: true,
      quantidade_atual: 8,
      saldo_reservado: 2,
    });
  });

  it("recusa nota sem remessa", async () => {
    const { usuario } = await criarUsuario();

    const resultado = await notaSaidaService.registrar({ remessas: [] }, usuario.id_usuario);

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("recusa remessa sem item", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [{ id_destinatario: destinatario.id_destinatario, itens: [] }],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.remessa.count()).toBe(0);
  });

  it("recusa remessa sem destinatário", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: 0,
            itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 1 }],
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("recusa produto repetido na mesma remessa", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const resultado = await notaSaidaService.registrar(
      {
        remessas: [
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [
              { id_produto: produto.id_produto, quantidade_solicitada: 1 },
              { id_produto: produto.id_produto, quantidade_solicitada: 2 },
            ],
          },
        ],
      },
      usuario.id_usuario,
    );

    expect("error" in resultado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.reservaEstoque.count()).toBe(0);
  });

  it("desfaz tudo quando uma remessa falha no meio da transação", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    await expect(
      notaSaidaService.registrar(
        {
          remessas: [
            {
              id_destinatario: destinatario.id_destinatario,
              itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 2 }],
            },
            {
              id_destinatario: destinatario.id_destinatario,
              itens: [{ id_produto: 999999, quantidade_solicitada: 1 }],
            },
          ],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow();

    expect(await prismaTeste.notaSaida.count()).toBe(0);
    expect(await prismaTeste.remessa.count()).toBe(0);
    expect(await prismaTeste.itemRemessa.count()).toBe(0);
    expect(await prismaTeste.reservaEstoque.count()).toBe(0);
    expect(await prismaTeste.estoque.count()).toBe(0);
    expect(await prismaTeste.registroAuditoria.count({ where: { entidade: "NotaSaida" } })).toBe(0);
  });
});

describe("notaSaidaDAO.list", () => {
  it("pagina as notas de saída com remessas e destinatários", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario({ razaoSocial: "Escola Municipal" });

    for (let i = 0; i < 2; i++) {
      const resultado = await notaSaidaService.registrar(
        {
          remessas: [
            {
              id_destinatario: destinatario.id_destinatario,
              itens: [{ id_produto: produto.id_produto, quantidade_solicitada: i + 1 }],
            },
          ],
        },
        usuario.id_usuario,
      );
      expect("error" in resultado).toBe(false);
    }

    const pagina = await notaSaidaDAO.list({ page: 1, limit: 1 });

    expect(pagina.total).toBe(2);
    expect(pagina.totalPages).toBe(2);
    expect(pagina.data).toHaveLength(1);
    expect(pagina.data[0]?.remessas).toHaveLength(1);
    expect(pagina.data[0]?.remessas[0]?.destinatario.pessoaJuridica.razao_social).toBe(
      "Escola Municipal",
    );
  });
});
