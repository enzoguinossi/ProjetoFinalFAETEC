import { describe, expect, it } from "vitest";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { pedidoService, gerarCsvPedidos } from "@/services/pedido";
import { hojeISO } from "@/lib/formatar";
import {
  criarConversao,
  criarDestinatario,
  criarEstoque,
  criarInventarioComItem,
  criarItemPedidoEscola,
  criarPedidoEscola,
  criarProduto,
  criarUsuario,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

async function cenario(opts: { fatorSaida?: number; saldo?: number } = {}) {
  const { usuario } = await criarUsuario();
  const { destinatario, pessoaJuridica } = await criarDestinatario();
  const conversaoSaida = await criarConversao(undefined, opts.fatorSaida ?? 1);
  const produto = await criarProduto({ idConversaoSaida: conversaoSaida.id_conversao });
  await criarEstoque(produto.id_produto, { quantidadeAtual: opts.saldo ?? 50 });
  return { usuario, destinatario, pessoaJuridica, produto, conversaoSaida };
}

describe("pedidoService.criar", () => {
  it("cria PENDENTE com data automática, observação e itens somados", async () => {
    const { usuario, destinatario, produto } = await cenario();

    const resultado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        observacao: "  Merenda de outubro  ",
        itens: [
          { id_produto: produto.id_produto, quantidade: 2, observacao: "  lote A  " },
          { id_produto: produto.id_produto, quantidade: 3.5 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: resultado.pedido.id_pedido_escola },
      include: { itens: true },
    });

    expect(pedido.status).toBe("PENDENTE");
    expect(pedido.observacao).toBe("Merenda de outubro");
    expect(pedido.data_criacao).toBeInstanceOf(Date);
    expect(pedido.id_nota_saida).toBeNull();
    expect((pedido as { ativo?: boolean }).ativo).toBeUndefined();
    // Produto repetido soma em um único item.
    expect(pedido.itens).toHaveLength(1);
    expect(Number(pedido.itens[0]!.quantidade)).toBe(5.5);
    expect(pedido.itens[0]!.observacao).toBe("lote A");

    const auditorias = await auditoriasDe("PedidoEscola", pedido.id_pedido_escola);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]!.acao).toBe("CRIAR");
  });

  it("recusa item vazio, quantidade inválida, escola/produto inexistente ou inativo", async () => {
    const { usuario, destinatario, produto } = await cenario();

    expect(
      "error" in
        (await pedidoService.criar(
          { id_destinatario: destinatario.id_destinatario, itens: [] },
          usuario.id_usuario,
        )),
    ).toBe(true);

    expect(
      "error" in
        (await pedidoService.criar(
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade: 0 }],
          },
          usuario.id_usuario,
        )),
    ).toBe(true);

    expect(
      "error" in
        (await pedidoService.criar(
          {
            id_destinatario: 999999,
            itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
          },
          usuario.id_usuario,
        )),
    ).toBe(true);

    const inativo = await criarProduto({ ativo: false });
    expect(
      "error" in
        (await pedidoService.criar(
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: inativo.id_produto, quantidade: 1 }],
          },
          usuario.id_usuario,
        )),
    ).toBe(true);
  });
});

describe("pedidoService lista e filtros", () => {
  it("filtra por escola, status, período, produto, com/sem nota e busca", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const outra = await criarDestinatario({ razaoSocial: "Creche Filtro" });

    const criar = async (idDestinatario: number) => {
      const resultado = await pedidoService.criar(
        {
          id_destinatario: idDestinatario,
          observacao: `Pedido ${idDestinatario}`,
          itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
        },
        usuario.id_usuario,
      );
      if ("error" in resultado) throw new Error(resultado.error);
      return resultado.pedido.id_pedido_escola;
    };

    const primeiro = await criar(destinatario.id_destinatario);
    await criar(outra.destinatario.id_destinatario);
    await pedidoService.aprovar(primeiro, usuario.id_usuario);

    const porEscola = await pedidoService.listar({
      destinatarios: [outra.destinatario.id_destinatario],
    });
    expect(porEscola.total).toBe(1);
    expect(porEscola.data[0]!.id_destinatario).toBe(outra.destinatario.id_destinatario);

    // Chips de escola/status enviam listas: mais de um valor não filtra só o último.
    const porDuasEscolas = await pedidoService.listar({
      destinatarios: [destinatario.id_destinatario, outra.destinatario.id_destinatario],
    });
    expect(porDuasEscolas.total).toBe(2);

    const porDoisStatus = await pedidoService.listar({
      status: ["PENDENTE", "CONFIRMADO"],
    });
    expect(porDoisStatus.total).toBe(2);

    const pendentes = await pedidoService.listar({ status: ["PENDENTE"] });
    expect(pendentes.total).toBe(1);

    const aprovados = await pedidoService.listar({ status: ["CONFIRMADO"] });
    expect(aprovados.total).toBe(1);

    const comNota = await pedidoService.listar({ com_nota: true });
    expect(comNota.total).toBe(0);
    const semNota = await pedidoService.listar({ com_nota: false });
    expect(semNota.total).toBe(2);

    const porProduto = await pedidoService.listar({ produtos: [produto.id_produto] });
    expect(porProduto.total).toBe(2);

    const busca = await pedidoService.listar({ search: "Creche Filtro" });
    expect(busca.total).toBe(1);

    const hoje = hojeISO();
    const porPeriodo = await pedidoService.listar({ de: hoje, ate: hoje });
    expect(porPeriodo.total).toBe(2);

    const foraDoPeriodo = await pedidoService.listar({
      de: "2000-01-01",
      ate: "2000-01-02",
    });
    expect(foraDoPeriodo.total).toBe(0);
  });

  it("aceita listas nos filtros dos chips (escola, status e produto)", async () => {
    const { destinatario: alfa } = await criarDestinatario({ razaoSocial: "Escola Alfa" });
    const { destinatario: beta } = await criarDestinatario({ razaoSocial: "Escola Beta" });
    const produtoX = await criarProduto();
    const produtoY = await criarProduto();

    const pedidoAlfa = await criarPedidoEscola(alfa.id_destinatario);
    await criarItemPedidoEscola(pedidoAlfa.id_pedido_escola, produtoX.id_produto, 1);

    const pedidoBeta = await criarPedidoEscola(beta.id_destinatario);
    await criarItemPedidoEscola(pedidoBeta.id_pedido_escola, produtoY.id_produto, 2);
    await prismaTeste.pedidoEscola.update({
      where: { id_pedido_escola: pedidoBeta.id_pedido_escola },
      data: { status: "CONFIRMADO" },
    });

    const duasEscolas = await pedidoService.listar({
      destinatarios: [alfa.id_destinatario, beta.id_destinatario],
    });
    expect(duasEscolas.total).toBe(2);

    const doisProdutos = await pedidoService.listar({
      produtos: [produtoX.id_produto, produtoY.id_produto],
    });
    expect(doisProdutos.total).toBe(2);

    const doisStatus = await pedidoService.listar({
      status: ["PENDENTE", "CONFIRMADO"],
    });
    expect(doisStatus.total).toBe(2);

    // Listas combinadas continuam sendo interseção (AND entre filtros).
    const combinado = await pedidoService.listar({
      produtos: [produtoX.id_produto],
      status: ["CONFIRMADO"],
    });
    expect(combinado.total).toBe(0);
  });
});

describe("pedidoService.atualizar e análise", () => {
  it("edita apenas pendente e aprova/recusa uma única vez com auditoria", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    const id = criado.pedido.id_pedido_escola;

    const atualizado = await pedidoService.atualizar(
      id,
      {
        id_destinatario: destinatario.id_destinatario,
        observacao: "Alterado",
        itens: [
          { id_produto: produto.id_produto, quantidade: 2 },
          { id_produto: produto.id_produto, quantidade: 3 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in atualizado) throw new Error(atualizado.error);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: id },
      include: { itens: true },
    });
    expect(pedido.observacao).toBe("Alterado");
    expect(pedido.itens).toHaveLength(1);
    expect(Number(pedido.itens[0]!.quantidade)).toBe(5);

    expect("error" in (await pedidoService.aprovar(id, usuario.id_usuario))).toBe(false);
    const aprovado = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: id },
    });
    expect(aprovado.status).toBe("CONFIRMADO");

    // Aprovado é histórico: não edita nem analisa de novo.
    expect(
      "error" in
        (await pedidoService.atualizar(
          id,
          {
            id_destinatario: destinatario.id_destinatario,
            itens: [{ id_produto: produto.id_produto, quantidade: 9 }],
          },
          usuario.id_usuario,
        )),
    ).toBe(true);
    expect("error" in (await pedidoService.recusar(id, usuario.id_usuario))).toBe(true);

    const auditorias = await auditoriasDe("PedidoEscola", id);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "ALTERAR", "ALTERAR"]);
  });

  it("recusa pendente e mantém no histórico", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    const resultado = await pedidoService.recusar(
      criado.pedido.id_pedido_escola,
      usuario.id_usuario,
    );
    expect("error" in resultado).toBe(false);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: criado.pedido.id_pedido_escola },
    });
    expect(pedido.status).toBe("RECUSADO");
    expect(pedido.id_nota_saida).toBeNull();
    expect(
      await prismaTeste.pedidoEscola.count({ where: { id_pedido_escola: pedido.id_pedido_escola } }),
    ).toBe(1);
  });
});

describe("pedidoService.importar", () => {
  it("cria uma nota nova com o total do pedido, sem reconverter, e vincula", async () => {
    const { usuario, destinatario, produto } = await cenario({ fatorSaida: 10, saldo: 100 });
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        observacao: "Importar",
        itens: [
          { id_produto: produto.id_produto, quantidade: 2, observacao: "prioridade" },
          { id_produto: produto.id_produto, quantidade: 3 },
        ],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    const id = criado.pedido.id_pedido_escola;
    await pedidoService.aprovar(id, usuario.id_usuario);

    expect(await pedidoService.listarParaImportacao()).toHaveLength(1);

    const importado = await pedidoService.importar(id, usuario.id_usuario);
    if ("error" in importado) throw new Error(importado.error);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: importado.nota.id_nota_saida },
      include: { itens: true },
    });
    expect(nota.tipo).toBe("SAIDA");
    expect(nota.status).toBe("ABERTA");
    expect(nota.id_destinatario).toBe(destinatario.id_destinatario);
    // Total do pedido (5) não é multiplicado pelo fator de saída (10).
    expect(nota.itens).toHaveLength(1);
    expect(Number(nota.itens[0]!.qtd_esperada)).toBe(5);
    // Observação do item do pedido viaja para o item da nota.
    expect(nota.itens[0]!.observacao).toBe("prioridade");

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: id },
    });
    expect(pedido.id_nota_saida).toBe(nota.id_nota_saida);

    // Sai da importação e não gera uma segunda nota.
    expect(await pedidoService.listarParaImportacao()).toHaveLength(0);
    expect("error" in (await pedidoService.importar(id, usuario.id_usuario))).toBe(true);
    expect(
      await prismaTeste.notaSaida.count({ where: { id_destinatario: destinatario.id_destinatario } }),
    ).toBe(1);

    const auditorias = await auditoriasDe("PedidoEscola", id);
    expect(auditorias.map((a) => a.acao)).toEqual(["CRIAR", "ALTERAR", "ALTERAR"]);
  });

  it("só importa pedido aprovado", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);

    expect("error" in (await pedidoService.importar(criado.pedido.id_pedido_escola, usuario.id_usuario))).toBe(
      true,
    );
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("RN001: avisa saldo insuficiente mas grava a nota", async () => {
    const { usuario, destinatario, produto } = await cenario({ saldo: 1 });
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 10 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    await pedidoService.aprovar(criado.pedido.id_pedido_escola, usuario.id_usuario);

    const importado = await pedidoService.importar(
      criado.pedido.id_pedido_escola,
      usuario.id_usuario,
    );
    if ("error" in importado) throw new Error(importado.error);

    expect(importado.aviso).toContain("RN001");
    expect(await prismaTeste.notaSaida.count()).toBe(1);
  });

  it("bloqueia a importação quando o produto está em inventário ativo", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 1 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    await pedidoService.aprovar(criado.pedido.id_pedido_escola, usuario.id_usuario);
    await criarInventarioComItem(produto.id_produto, usuario.id_usuario);

    const importado = await pedidoService.importar(
      criado.pedido.id_pedido_escola,
      usuario.id_usuario,
    );
    expect("error" in importado).toBe(true);
    expect(await prismaTeste.notaSaida.count()).toBe(0);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: criado.pedido.id_pedido_escola },
    });
    expect(pedido.id_nota_saida).toBeNull();
  });
});

describe("vínculo da nota ao pedido", () => {
  async function pedidoAprovado() {
    const ctx = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: ctx.destinatario.id_destinatario,
        itens: [{ id_produto: ctx.produto.id_produto, quantidade: 5 }],
      },
      ctx.usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    await pedidoService.aprovar(criado.pedido.id_pedido_escola, ctx.usuario.id_usuario);
    return { ...ctx, id: criado.pedido.id_pedido_escola };
  }

  it("recusa nota com destinatário diferente do pedido", async () => {
    const { usuario, produto, id } = await pedidoAprovado();
    const outra = await criarDestinatario({ razaoSocial: "Outra escola" });

    await expect(
      notaSaidaDAO.create(
        {
          tipo: "SAIDA",
          id_destinatario: outra.destinatario.id_destinatario,
          urgente: false,
          observacao: null,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 5, total_base: true }],
          id_pedido_escola: id,
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/destinatário/i);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: id },
    });
    expect(pedido.id_nota_saida).toBeNull();
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });

  it("recusa nota com item/quantidade divergente do pedido", async () => {
    const { usuario, destinatario, produto, id } = await pedidoAprovado();

    await expect(
      notaSaidaDAO.create(
        {
          tipo: "SAIDA",
          id_destinatario: destinatario.id_destinatario,
          urgente: false,
          observacao: null,
          itens: [{ id_produto: produto.id_produto, quantidade_solicitada: 4, total_base: true }],
          id_pedido_escola: id,
        },
        usuario.id_usuario,
      ),
    ).rejects.toThrow(/itens\/quantidades/i);

    const pedido = await prismaTeste.pedidoEscola.findUniqueOrThrow({
      where: { id_pedido_escola: id },
    });
    expect(pedido.id_nota_saida).toBeNull();
    expect(await prismaTeste.notaSaida.count()).toBe(0);
  });
});

describe("unicidade de produto por nota", () => {
  it("o banco recusa produto duplicado em item_nota_saida", async () => {
    const { usuario, destinatario, produto } = await cenario();
    const nota = await prismaTeste.notaSaida.create({
      data: {
        id_destinatario: destinatario.id_destinatario,
        data_criacao: new Date(),
        tipo: "SAIDA",
        status: "ABERTA",
      },
    });

    await prismaTeste.itemNotaSaida.create({
      data: { id_nota_saida: nota.id_nota_saida, id_produto: produto.id_produto, qtd_esperada: 1 },
    });

    await expect(
      prismaTeste.itemNotaSaida.create({
        data: { id_nota_saida: nota.id_nota_saida, id_produto: produto.id_produto, qtd_esperada: 2 },
      }),
    ).rejects.toThrow();

    void usuario;
  });

  it("o banco recusa produto duplicado em item_nota_entrada", async () => {
    const { usuario, produto } = await cenario();
    const nota = await prismaTeste.notaEntrada.create({
      data: { data_criacao: new Date(), tipo: "ENTRADA" },
    });

    await prismaTeste.itemNotaEntrada.create({
      data: { id_nota_entrada: nota.id_nota_entrada, id_produto: produto.id_produto, quantidade: 1 },
    });

    await expect(
      prismaTeste.itemNotaEntrada.create({
        data: { id_nota_entrada: nota.id_nota_entrada, id_produto: produto.id_produto, quantidade: 2 },
      }),
    ).rejects.toThrow();

    void usuario;
  });
});

describe("relatório de pedidos", () => {
  it("monta as linhas por escola e o CSV com itens, total e nota", async () => {
    const { usuario, destinatario, pessoaJuridica, produto } = await cenario();
    const criado = await pedidoService.criar(
      {
        id_destinatario: destinatario.id_destinatario,
        itens: [{ id_produto: produto.id_produto, quantidade: 4 }],
      },
      usuario.id_usuario,
    );
    if ("error" in criado) throw new Error(criado.error);
    await pedidoService.aprovar(criado.pedido.id_pedido_escola, usuario.id_usuario);
    const importado = await pedidoService.importar(
      criado.pedido.id_pedido_escola,
      usuario.id_usuario,
    );
    if ("error" in importado) throw new Error(importado.error);

    const linhas = await pedidoService.relatorio({ com_nota: true });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.escola).toBe(pessoaJuridica.razao_social);
    expect(linhas[0]!.status).toBe("Aprovado");
    expect(linhas[0]!.total).toBe(4);
    expect(linhas[0]!.nota).toBe(importado.nota.id_nota_saida);
    expect(linhas[0]!.itens[0]!.descricao).toBe(produto.descricao);

    const csv = gerarCsvPedidos(linhas);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Pedido;Data;Escola;Status;Itens;Total;Nota de saída");
    expect(csv).toContain(pessoaJuridica.razao_social);
    expect(csv).toContain(`${produto.descricao} (4)`);
    expect(csv).toContain(String(importado.nota.id_nota_saida));

    expect(await pedidoService.relatorio({ com_nota: false })).toHaveLength(0);
  });
});
