import { describe, expect, it } from "vitest";
import { inventarioDAO } from "@/dao/inventario";
import { saldoDAO } from "@/dao/estoque";
import { produtoDAO } from "@/dao/produto";
import {
  criarEstoque,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";
import { auditoriasDe } from "../helpers/db";

async function cenarioProduto(descricao: string, saldo = 10) {
  const produto = await criarProduto({ descricao });
  await criarEstoque(produto.id_produto, { quantidadeAtual: saldo });
  return produto;
}

async function cenarioInventario(
  status: "ABERTO" | "AGUARDANDO_APROVACAO" = "ABERTO",
) {
  const { usuario, funcionario } = await criarUsuario();
  const primeiro = await cenarioProduto("Produto A", 10);
  const segundo = await cenarioProduto("Produto B", 10);
  const inventario = await inventarioDAO.criar(
    {
      observacao: "Contagem de teste",
      contagem_cega: true,
      todos: false,
      id_produtos: [primeiro.id_produto, segundo.id_produto],
    },
    usuario.id_usuario,
  );
  const detalhe = await inventarioDAO.getById(inventario.id_inventario);
  const itens = detalhe!.itens;

  if (status === "AGUARDANDO_APROVACAO") {
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: itens[0]!.id_item_inventario,
        quantidade: 8,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: itens[1]!.id_item_inventario,
        quantidade: 10,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);
  }

  return { usuario, funcionario, primeiro, segundo, inventario, itens };
}

describe("inventarioDAO", () => {
  it("abre com snapshot do saldo, status ABERTO e auditoria", async () => {
    const { usuario, primeiro, segundo, inventario } = await cenarioInventario();

    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    expect(detalhe?.status).toBe("ABERTO");
    expect(detalhe?.contagem_cega).toBe(true);
    expect(detalhe?.itens).toHaveLength(2);
    expect(detalhe?.itens.map((item) => Number(item.quantidade_sistema))).toEqual([
      10, 10,
    ]);
    expect(detalhe?.itens[0]?.produto.id_produto).toBe(primeiro.id_produto);
    expect(detalhe?.itens[1]?.produto.id_produto).toBe(segundo.id_produto);

    const auditorias = await auditoriasDe("Inventario", inventario.id_inventario);
    expect(auditorias[0]?.acao).toBe("CRIAR");
    expect(auditorias[0]?.dados_novos).toMatchObject({ status: "ABERTO" });
    expect(usuario.id_usuario).toBeGreaterThan(0);
  });

  it("bloqueia todas as movimentações de saldo do produto inventariado", async () => {
    const { usuario, primeiro } = await cenarioInventario();
    const outro = await cenarioProduto("Produto fora", 5);

    await expect(
      saldoDAO.registrarEntrada({
        id_produto: primeiro.id_produto,
        id_usuario: usuario.id_usuario,
        id_nota_entrada: 999,
        quantidade: 1,
        data_entrada: new Date(),
      }),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
    await expect(
      saldoDAO.reservar({
        id_produto: primeiro.id_produto,
        id_nota_saida: 999,
        id_usuario: usuario.id_usuario,
        quantidade: 1,
      }),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
    await expect(
      saldoDAO.liberarReserva({
        id_produto: primeiro.id_produto,
        id_nota_saida: 999,
        id_usuario: usuario.id_usuario,
        quantidade: 1,
      }),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
    await expect(
      saldoDAO.baixar({
        id_produto: primeiro.id_produto,
        id_nota_saida: 999,
        id_usuario: usuario.id_usuario,
        quantidade: 1,
      }),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
    await expect(
      saldoDAO.baixarDireto({
        id_produto: primeiro.id_produto,
        id_nota_saida: 999,
        id_usuario: usuario.id_usuario,
        quantidade: 1,
      }),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
    await expect(
      saldoDAO.movimentar(primeiro.id_produto, usuario.id_usuario, 1),
    ).rejects.toThrow(/bloqueado pelo inventário/i);

    const fora = await saldoDAO.movimentar(outro.id_produto, usuario.id_usuario, 2);
    expect(Number(fora.produto.saldo)).toBe(7);
  });

  it("mantém uma contagem por funcionário/item e atualiza a contagem existente", async () => {
    const { usuario, funcionario, inventario, itens } = await cenarioInventario();
    const item = itens[0]!;

    const primeira = await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: item.id_item_inventario,
        quantidade: 7,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    const segunda = await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: item.id_item_inventario,
        quantidade: 9,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    const outroFuncionario = await criarUsuario();
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: item.id_item_inventario,
        quantidade: 11,
        id_funcionario: outroFuncionario.funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );

    expect(segunda.id_contagem_inventario).toBe(primeira.id_contagem_inventario);
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    expect(detalhe?.status).toBe("EM_CONTAGEM");
    expect(detalhe?.itens[0]?.contagens).toHaveLength(2);
    expect(
      detalhe?.itens[0]?.contagens
        .map((c) => Number(c.quantidade_contada))
        .sort((a, b) => a - b),
    ).toEqual([9, 11]);

    await expect(
      inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario),
    ).rejects.toThrow(/sem contagem/i);

    const auditorias = await auditoriasDe(
      "ContagemInventario",
      primeira.id_contagem_inventario,
    );
    expect(auditorias.map((a) => a.acao)).toContain("CRIAR");
    expect(auditorias.map((a) => a.acao)).toContain("ALTERAR");
  });

  it("fecha a contagem e calcula a média aritmética", async () => {
    const { usuario, funcionario, inventario, itens } = await cenarioInventario();
    for (const item of itens) {
      await inventarioDAO.contar(
        {
          id_inventario: inventario.id_inventario,
          id_item_inventario: item.id_item_inventario,
          quantidade: item.id_produto === itens[0]!.id_produto ? 7 : 10,
          id_funcionario: funcionario.id_funcionario,
        },
        usuario.id_usuario,
      );
    }
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: itens[0]!.id_item_inventario,
        quantidade: 9,
        id_funcionario: (await criarUsuario()).funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );

    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    expect(detalhe?.status).toBe("AGUARDANDO_APROVACAO");
    expect(
      (detalhe?.itens[0]?.contagens.reduce(
        (soma, contagem) => soma + Number(contagem.quantidade_contada),
        0,
      ) ?? 0) / (detalhe?.itens[0]?.contagens.length ?? 1),
    ).toBe(8);
  });

  it("decide a média, atualiza o saldo e vincula a movimentação ao ajuste", async () => {
    const { usuario, funcionario, primeiro, segundo, inventario } =
      await cenarioInventario("AGUARDANDO_APROVACAO");

    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: primeiro.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      justificativa: "Média confere",
      id_usuario: usuario.id_usuario,
    });

    const produto = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: primeiro.id_produto },
    });
    expect(Number(produto.saldo)).toBe(8);

    const ajuste = await prismaTeste.ajusteInventario.findFirstOrThrow({
      where: { id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto },
      include: { movimentacoes: true },
    });
    expect(ajuste.quantidade_contada).toBe(8);
    expect(ajuste.origem).toBe("MEDIA");
    expect(ajuste.status).toBe("APROVADO");
    expect(ajuste.movimentacoes[0]).toMatchObject({
      quantidade: -2,
      saldo_anterior: 10,
      saldo_posterior: 8,
    });

    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: segundo.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });

    await inventarioDAO.finalizar(inventario.id_inventario, usuario.id_usuario);

    const finalizado = await inventarioDAO.getById(inventario.id_inventario);
    expect(finalizado?.status).toBe("FINALIZADO");
    expect(finalizado?.data_fim).not.toBeNull();
    expect(finalizado?.usuarioAprovacao?.id_usuario).toBe(usuario.id_usuario);
    expect(funcionario.id_funcionario).toBeGreaterThan(0);
  });

  it("não cria ajuste quando não há diferença e não altera o saldo na rejeição", async () => {
    const { usuario, primeiro, segundo, inventario } =
      await cenarioInventario("AGUARDANDO_APROVACAO");

    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: primeiro.id_produto,
      origem: "MEDIA",
      status: "REJEITADO",
      justificativa: "Contagem inconsistente",
      id_usuario: usuario.id_usuario,
    });
    const produto = await prismaTeste.produto.findUniqueOrThrow({
      where: { id_produto: primeiro.id_produto },
    });
    expect(Number(produto.saldo)).toBe(10);
    const ajuste = await prismaTeste.ajusteInventario.findFirstOrThrow({
      where: { id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto },
    });
    expect(ajuste.status).toBe("REJEITADO");
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_ajuste_inventario: ajuste.id_ajuste_inventario },
      }),
    ).toBe(0);

    const semAjuste = await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: segundo.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    expect(semAjuste.ajuste).toBeNull();
    expect(semAjuste.movimentacao).toBeNull();
    expect(semAjuste.quantidade_final).toBe(10);
    const itemSegundo = await prismaTeste.itemInventario.findFirstOrThrow({
      where: { id_inventario: inventario.id_inventario, id_produto: segundo.id_produto },
    });
    expect(itemSegundo.quantidade_final).toBe(10);
    expect(await prismaTeste.ajusteInventario.count({
      where: { id_inventario: inventario.id_inventario, id_produto: segundo.id_produto },
    })).toBe(0);
    await inventarioDAO.finalizar(inventario.id_inventario, usuario.id_usuario);
  });

  it("cancela antes de qualquer ajuste e libera o bloqueio, preservando itens/contagens", async () => {
    const { usuario, funcionario, primeiro, inventario, itens } =
      await cenarioInventario("AGUARDANDO_APROVACAO");
    expect(itens).toHaveLength(2);

    await inventarioDAO.cancelar(inventario.id_inventario, usuario.id_usuario);
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    expect(detalhe?.status).toBe("CANCELADO");
    expect(detalhe?.data_fim).not.toBeNull();
    expect(detalhe?.itens).toHaveLength(2);
    expect(detalhe?.itens[0]?.contagens.length).toBeGreaterThan(0);

    const movimento = await saldoDAO.movimentar(
      primeiro.id_produto,
      usuario.id_usuario,
      1,
    );
    expect(Number(movimento.produto.saldo)).toBe(11);
    expect(funcionario.id_funcionario).toBeGreaterThan(0);
  });

  it("não cancela depois de ajuste aprovado com movimentação", async () => {
    const { usuario, primeiro, inventario } =
      await cenarioInventario("AGUARDANDO_APROVACAO");
    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: primeiro.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    await expect(
      inventarioDAO.cancelar(inventario.id_inventario, usuario.id_usuario),
    ).rejects.toThrow(/ajuste aprovado/i);
  });

  it("permite editar e excluir apenas antes da primeira contagem", async () => {
    const { usuario, inventario } = await cenarioInventario();
    const novo = await cenarioProduto("Produto C", 4);

    await inventarioDAO.atualizar(
      inventario.id_inventario,
      {
        observacao: "Nome editado",
        contagem_cega: false,
        todos: false,
        id_produtos: [novo.id_produto],
      },
      usuario.id_usuario,
    );
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    expect(detalhe?.observacao).toBe("Nome editado");
    expect(detalhe?.itens).toHaveLength(1);
    expect(detalhe?.itens[0]?.produto.id_produto).toBe(novo.id_produto);

    await inventarioDAO.excluir(inventario.id_inventario, usuario.id_usuario);
    expect(await inventarioDAO.getById(inventario.id_inventario)).toBeNull();
    const auditorias = await prismaTeste.registroAuditoria.findMany({
      where: { entidade: "Inventario", acao: "EXCLUIR" },
    });
    expect(auditorias).toHaveLength(1);
  });

  it("bloqueia edição e exclusão depois da primeira contagem", async () => {
    const { usuario, funcionario, inventario, itens } = await cenarioInventario();
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: itens[0]!.id_item_inventario,
        quantidade: 9,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );

    await expect(
      inventarioDAO.atualizar(
        inventario.id_inventario,
        {
          observacao: "Outro",
          contagem_cega: false,
          todos: true,
          id_produtos: [],
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/antes da primeira contagem/i);
    await expect(
      inventarioDAO.excluir(inventario.id_inventario, usuario.id_usuario),
    ).rejects.toThrow(/já possui contagens/i);
  });
  it("permite escolher a contagem individual quando a média é igual ao sistema", async () => {
    const { usuario, funcionario, primeiro, inventario, itens } = await cenarioInventario();
    const item = itens[0]!;
    const primeira = await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: item.id_item_inventario, quantidade: 8, id_funcionario: funcionario.id_funcionario },
      usuario.id_usuario,
    );
    const outro = await criarUsuario();
    await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: item.id_item_inventario, quantidade: 12, id_funcionario: outro.funcionario.id_funcionario },
      usuario.id_usuario,
    );
    await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: itens[1]!.id_item_inventario, quantidade: 10, id_funcionario: funcionario.id_funcionario },
      usuario.id_usuario,
    );
    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);

    const decisao = await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: primeiro.id_produto,
      origem: "CONTAGEM",
      id_contagem_inventario: primeira.id_contagem_inventario,
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    expect(decisao.delta).toBe(-2);
    expect(decisao.ajuste).not.toBeNull();

    const produto = await prismaTeste.produto.findUniqueOrThrow({ where: { id_produto: primeiro.id_produto } });
    expect(Number(produto.saldo)).toBe(8);
    const itemDepois = await prismaTeste.itemInventario.findUniqueOrThrow({ where: { id_item_inventario: item.id_item_inventario } });
    expect(itemDepois.quantidade_final).toBe(8);
    expect(itemDepois.origem).toBe("CONTAGEM");
    expect(itemDepois.id_contagem_inventario).toBe(primeira.id_contagem_inventario);
  });

  it("decide sem ajuste quando a contagem individual escolhida é igual ao sistema", async () => {
    const { usuario, funcionario, primeiro, inventario, itens } = await cenarioInventario();
    const item = itens[0]!;
    const individual = await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: item.id_item_inventario, quantidade: 10, id_funcionario: funcionario.id_funcionario },
      usuario.id_usuario,
    );
    const outro = await criarUsuario();
    await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: item.id_item_inventario, quantidade: 8, id_funcionario: outro.funcionario.id_funcionario },
      usuario.id_usuario,
    );
    await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: itens[1]!.id_item_inventario, quantidade: 10, id_funcionario: funcionario.id_funcionario },
      usuario.id_usuario,
    );
    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);

    const decisao = await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: primeiro.id_produto,
      origem: "CONTAGEM",
      id_contagem_inventario: individual.id_contagem_inventario,
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    expect(decisao.delta).toBe(0);
    expect(decisao.ajuste).toBeNull();
    expect(await prismaTeste.ajusteInventario.count({ where: { id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto } })).toBe(0);
    const itemDepois = await prismaTeste.itemInventario.findUniqueOrThrow({ where: { id_item_inventario: item.id_item_inventario } });
    expect(itemDepois.quantidade_final).toBe(10);
    expect(itemDepois.decidido_em).not.toBeNull();
    expect(itemDepois.id_usuario_decisao).toBe(usuario.id_usuario);

    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: itens[1]!.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    await inventarioDAO.finalizar(inventario.id_inventario, usuario.id_usuario);
    const finalizado = await inventarioDAO.getById(inventario.id_inventario);
    expect(finalizado?.status).toBe("FINALIZADO");
  });

  it("valida status, origem e justificativa da decisão", async () => {
    const { usuario, primeiro, inventario } = await cenarioInventario("AGUARDANDO_APROVACAO");
    await expect(
      inventarioDAO.decidirAjuste({ id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto, origem: "MEDIA", status: "PENDENTE" as never, id_usuario: usuario.id_usuario }),
    ).rejects.toThrow(/APROVADO ou REJEITADO/i);
    await expect(
      inventarioDAO.decidirAjuste({ id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto, origem: "OUTRA" as never, status: "APROVADO", id_usuario: usuario.id_usuario }),
    ).rejects.toThrow(/MEDIA ou CONTAGEM/i);
    await expect(
      inventarioDAO.decidirAjuste({ id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto, origem: "MEDIA", status: "REJEITADO", id_usuario: usuario.id_usuario }),
    ).rejects.toThrow(/justificativa/i);
  });

  it("impede sobreposição de inventário ativo para o mesmo produto", async () => {
    const { usuario, primeiro } = await cenarioInventario();
    await expect(
      inventarioDAO.criar(
        { observacao: "Sobreposto", contagem_cega: true, todos: false, id_produtos: [primeiro.id_produto] },
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/bloqueado pelo inventário/i);
  });

  it("impede hard delete de produto que participa de inventário", async () => {
    const { usuario, primeiro } = await cenarioInventario();
    await expect(
      produtoDAO.hardDelete(primeiro.id_produto, usuario.id_usuario),
    ).rejects.toThrow(/inventário/i);
  });

  it("serializa duas aberturas concorrentes do mesmo produto", async () => {
    const { usuario } = await criarUsuario();
    const produto = await cenarioProduto("Produto concorrente", 10);
    const input = {
      observacao: "Abertura concorrente",
      contagem_cega: true,
      todos: false,
      id_produtos: [produto.id_produto],
    };

    const resultados = await Promise.allSettled([
      inventarioDAO.criar(input, usuario.id_usuario),
      inventarioDAO.criar(input, usuario.id_usuario),
    ]);
    const sucessos = resultados.filter((r) => r.status === "fulfilled");
    const falhas = resultados.filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect(String((falhas[0] as PromiseRejectedResult).reason)).toMatch(/bloqueado pelo inventário/i);
  });

  it("serializa decisão e cancelamento concorrentes sem ajuste em cancelado", async () => {
    const { usuario, primeiro, inventario } = await cenarioInventario("AGUARDANDO_APROVACAO");

    const [decisao, cancelamento] = await Promise.allSettled([
      inventarioDAO.decidirAjuste({
        id_inventario: inventario.id_inventario,
        id_produto: primeiro.id_produto,
        origem: "MEDIA",
        status: "APROVADO",
        id_usuario: usuario.id_usuario,
      }),
      inventarioDAO.cancelar(inventario.id_inventario, usuario.id_usuario),
    ]);

    const atual = await inventarioDAO.getById(inventario.id_inventario);
    if (cancelamento.status === "fulfilled") {
      expect(atual?.status).toBe("CANCELADO");
      expect(decisao.status).toBe("rejected");
      expect(
        await prismaTeste.ajusteInventario.count({
          where: { id_inventario: inventario.id_inventario },
        }),
      ).toBe(0);
    } else {
      expect(decisao.status).toBe("fulfilled");
      expect(cancelamento.status).toBe("rejected");
      expect(atual?.status).toBe("AGUARDANDO_APROVACAO");
      expect(
        await prismaTeste.ajusteInventario.count({
          where: { id_inventario: inventario.id_inventario, id_produto: primeiro.id_produto },
        }),
      ).toBe(1);
    }
  });

  describe("list", () => {
    async function criarInventarioLista(opts: {
      status: "ABERTO" | "EM_CONTAGEM" | "AGUARDANDO_APROVACAO" | "FINALIZADO" | "CANCELADO";
      dataInicio?: string;
      contagemCega?: boolean;
      observacao?: string;
    }) {
      const { usuario } = await criarUsuario({ senhaAlteradaEm: null });
      return prismaTeste.inventario.create({
        data: {
          data_inicio: new Date(
            `${opts.dataInicio ?? "2026-11-05"}T00:00:00.000Z`,
          ),
          contagem_cega: opts.contagemCega ?? false,
          status: opts.status,
          id_usuario_abertura: usuario.id_usuario,
          observacao: opts.observacao,
        },
      });
    }

    it("filtra por status em lista e mantém o default sem filtros", async () => {
      const aberto = await criarInventarioLista({ status: "ABERTO" });
      const finalizado = await criarInventarioLista({ status: "FINALIZADO" });
      const cancelado = await criarInventarioLista({ status: "CANCELADO" });

      const semFiltro = await inventarioDAO.list({ limit: 100 });
      expect(semFiltro.data.map((item) => item.id_inventario).sort()).toEqual(
        [aberto.id_inventario, finalizado.id_inventario, cancelado.id_inventario].sort(),
      );

      const filtrados = await inventarioDAO.list({
        status: ["ABERTO", "CANCELADO"],
        limit: 100,
      });
      expect(filtrados.data.map((item) => item.id_inventario).sort()).toEqual(
        [aberto.id_inventario, cancelado.id_inventario].sort(),
      );
      expect(filtrados.total).toBe(2);
    });

    it("filtra por período de data de início, com dia inicial e final inclusivos", async () => {
      const antes = await criarInventarioLista({
        status: "ABERTO",
        dataInicio: "2026-11-05",
      });
      const meio = await criarInventarioLista({
        status: "ABERTO",
        dataInicio: "2026-11-07",
      });
      const depois = await criarInventarioLista({
        status: "ABERTO",
        dataInicio: "2026-11-09",
      });

      const periodo = await inventarioDAO.list({
        de: "2026-11-05",
        ate: "2026-11-07",
        limit: 100,
      });
      expect(periodo.data.map((item) => item.id_inventario).sort()).toEqual(
        [antes.id_inventario, meio.id_inventario].sort(),
      );

      const soAte = await inventarioDAO.list({ ate: "2026-11-05", limit: 100 });
      expect(soAte.data.map((item) => item.id_inventario)).toEqual([
        antes.id_inventario,
      ]);

      const soDe = await inventarioDAO.list({ de: "2026-11-09", limit: 100 });
      expect(soDe.data.map((item) => item.id_inventario)).toEqual([
        depois.id_inventario,
      ]);
    });

    it("filtra por contagem cega quando marcado", async () => {
      const cega = await criarInventarioLista({
        status: "ABERTO",
        contagemCega: true,
      });
      const aberta = await criarInventarioLista({
        status: "ABERTO",
        contagemCega: false,
      });

      const filtrados = await inventarioDAO.list({
        contagemCega: true,
        limit: 100,
      });
      expect(filtrados.data.map((item) => item.id_inventario)).toEqual([
        cega.id_inventario,
      ]);

      const semMarcar = await inventarioDAO.list({ limit: 100 });
      expect(semMarcar.data.map((item) => item.id_inventario).sort()).toEqual(
        [cega.id_inventario, aberta.id_inventario].sort(),
      );
    });

    it("combina a busca livre com os filtros de domínio", async () => {
      const cegaNorte = await criarInventarioLista({
        status: "ABERTO",
        contagemCega: true,
        observacao: "Contagem Norte",
      });
      const abertaNorte = await criarInventarioLista({
        status: "ABERTO",
        contagemCega: false,
        observacao: "Contagem Norte",
      });

      const busca = await inventarioDAO.list({ search: "Norte", limit: 100 });
      expect(busca.data.map((item) => item.id_inventario).sort()).toEqual(
        [cegaNorte.id_inventario, abertaNorte.id_inventario].sort(),
      );

      const combinados = await inventarioDAO.list({
        search: "Norte",
        contagemCega: true,
        limit: 100,
      });
      expect(combinados.data.map((item) => item.id_inventario)).toEqual([
        cegaNorte.id_inventario,
      ]);
    });
  });
});
