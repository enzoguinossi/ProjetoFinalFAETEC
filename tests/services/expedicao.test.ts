import { describe, expect, it } from "vitest";
import {
  criarDestinatario,
  criarEstoque,
  criarExpedicao,
  criarItemNotaSaida,
  criarNotaSaida,
  criarProduto,
  criarUsuario,
  criarVeiculo,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";
import { expedicaoDAO } from "@/dao/expedicao";
import { expedicaoService } from "@/services/expedicao";

type StatusNotaTeste =
  | "ABERTA"
  | "PENDENTE"
  | "BAIXA_PARCIAL"
  | "BAIXA_TOTAL"
  | "BAIXA_COM_CORTE"
  | "CANCELADA";

async function criarNota(
  idDestinatario: number,
  opts: {
    status?: StatusNotaTeste;
    esperada?: number;
    entregue?: number;
  } = {},
) {
  const produto = await criarProduto();
  const estoque = await criarEstoque(produto.id_produto, {
    quantidadeAtual: 100,
  });
  const nota = await criarNotaSaida({ idDestinatario });

  if (opts.status) {
    await prismaTeste.notaSaida.update({
      where: { id_nota_saida: nota.id_nota_saida },
      data: { status: opts.status },
    });
  }

  await criarItemNotaSaida(
    nota.id_nota_saida,
    estoque.id_estoque,
    opts.esperada ?? 10,
  );

  if (opts.entregue) {
    await prismaTeste.itemNotaSaida.updateMany({
      where: { id_nota_saida: nota.id_nota_saida },
      data: { qtd_entregue: opts.entregue },
    });
  }

  return nota;
}

async function criarPercurso(
  destinatarios: { id_destinatario: number }[],
) {
  const percurso = await prismaTeste.percurso.create({
    data: { nome: `Percurso ${Date.now()}-${Math.random()}` },
  });
  await prismaTeste.percursoDestinatario.createMany({
    data: destinatarios.map((destinatario, indice) => ({
      id_percurso: percurso.id_percurso,
      id_destinatario: destinatario.id_destinatario,
      ordem_visita: indice + 1,
    })),
  });
  return percurso;
}

async function ocuparNotaEmOutraExpedicao(idNotaSaida: number) {
  const outra = await prismaTeste.expedicao.create({
    data: { data_criacao: new Date(), status: "PLANEJADA" },
  });
  await prismaTeste.expedicaoNota.create({
    data: {
      id_expedicao: outra.id_expedicao,
      id_nota_saida: idNotaSaida,
      ordem_visita: 1,
      data_adicao: new Date(),
    },
  });
  return outra;
}

/**
 * Monta uma nota `EM_PERCURSO` já ligada a uma expedição `EM_PERCURSO`, com o
 * estoque reservado das quantidades esperadas — o cenário do qual a entrega
 * parte.
 */
async function montarEntregaEmPercurso(
  quantidades: number[],
  opts: {
    entregues?: number[];
    quantidadeAtual?: number;
    saldoReservado?: number[];
  } = {},
) {
  const { usuario } = await criarUsuario();
  const { destinatario } = await criarDestinatario();
  const veiculo = await criarVeiculo({ status: "EM_EXPEDICAO" });
  const nota = await criarNotaSaida({
    idDestinatario: destinatario.id_destinatario,
  });

  const estoques = [];
  const itens = [];

  for (const [indice, quantidade] of quantidades.entries()) {
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: opts.quantidadeAtual ?? 100,
      saldoReservado: opts.saldoReservado?.[indice] ?? quantidade,
    });
    const item = await criarItemNotaSaida(
      nota.id_nota_saida,
      estoque.id_estoque,
      quantidade,
    );

    if (opts.entregues?.[indice] !== undefined) {
      await prismaTeste.itemNotaSaida.update({
        where: { id_item_nota_saida: item.id_item_nota_saida },
        data: { qtd_entregue: opts.entregues[indice] },
      });
    }

    estoques.push(estoque);
    itens.push(item);
  }

  const expedicao = await criarExpedicao({
    idVeiculo: veiculo.id_veiculo,
    status: "EM_PERCURSO",
  });
  await prismaTeste.expedicaoNota.create({
    data: {
      id_expedicao: expedicao.id_expedicao,
      id_nota_saida: nota.id_nota_saida,
      ordem_visita: 1,
      data_adicao: new Date(),
    },
  });
  await prismaTeste.notaSaida.update({
    where: { id_nota_saida: nota.id_nota_saida },
    data: { status: "EM_PERCURSO" },
  });

  return { usuario, veiculo, nota, estoques, itens, expedicao };
}

function entregaDe(
  itens: { id_item_nota_saida: number }[],
  quantidades: number[],
) {
  return itens.map((item, indice) => ({
    id_item_nota_saida: item.id_item_nota_saida,
    qtd_entregue: quantidades[indice] ?? 0,
  }));
}

describe("expedicaoService", () => {
  it("cria com percurso e acrescenta as notas elegíveis na ordem do percurso", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario: escolaA } = await criarDestinatario({
      razaoSocial: "Escola A",
    });
    const { destinatario: escolaB } = await criarDestinatario({
      razaoSocial: "Escola B",
    });
    const { destinatario: escolaC } = await criarDestinatario({
      razaoSocial: "Escola C",
    });
    const { destinatario: foraDoPercurso } = await criarDestinatario({
      razaoSocial: "Escola D",
    });

    const notaA = await criarNota(escolaA.id_destinatario);
    const notaB = await criarNota(escolaB.id_destinatario);
    const notaC = await criarNota(escolaC.id_destinatario);
    const notaFora = await criarNota(foraDoPercurso.id_destinatario);

    // Não entram: nota sem saldo pendente e nota já em outra expedição ativa.
    await criarNota(escolaA.id_destinatario, {
      esperada: 10,
      entregue: 10,
    });
    const notaOcupada = await criarNota(escolaC.id_destinatario);
    await ocuparNotaEmOutraExpedicao(notaOcupada.id_nota_saida);

    // Ordem do percurso: C, A, B.
    const percurso = await criarPercurso([escolaC, escolaA, escolaB]);

    const resultado = await expedicaoService.criar(
      { data_prevista: "2026-11-05", id_percurso: percurso.id_percurso },
      usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    const expedicao = await prismaTeste.expedicao.findUniqueOrThrow({
      where: { id_expedicao: resultado.expedicao.id_expedicao },
      include: { notas: { orderBy: { ordem_visita: "asc" } } },
    });

    expect(expedicao.status).toBe("PLANEJADA");
    expect(expedicao.data_prevista?.toISOString().slice(0, 10)).toBe(
      "2026-11-05",
    );
    expect(
      expedicao.notas.map((nota) => ({
        id_nota_saida: nota.id_nota_saida,
        ordem_visita: nota.ordem_visita,
      })),
    ).toEqual([
      { id_nota_saida: notaC.id_nota_saida, ordem_visita: 1 },
      { id_nota_saida: notaA.id_nota_saida, ordem_visita: 2 },
      { id_nota_saida: notaB.id_nota_saida, ordem_visita: 3 },
    ]);
    expect(
      expedicao.notas.some(
        (nota) => nota.id_nota_saida === notaFora.id_nota_saida,
      ),
    ).toBe(false);

    const auditorias = await auditoriasDe(
      "Expedicao",
      expedicao.id_expedicao,
    );
    expect(auditorias.map((auditoria) => auditoria.acao)).toEqual(["CRIAR"]);
    expect(auditorias[0]?.dados_novos).toMatchObject({
      status: "PLANEJADA",
      notas: [
        { id_nota_saida: notaC.id_nota_saida, ordem_visita: 1 },
        { id_nota_saida: notaA.id_nota_saida, ordem_visita: 2 },
        { id_nota_saida: notaB.id_nota_saida, ordem_visita: 3 },
      ],
    });
  });

  it("só adiciona nota elegível e impede a mesma nota em duas expedições ativas", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();

    const primeira = await expedicaoService.criar(
      { observacao: "Primeira" },
      usuario.id_usuario,
    );
    if ("error" in primeira) throw new Error(primeira.error);
    const segunda = await expedicaoService.criar(
      { observacao: "Segunda" },
      usuario.id_usuario,
    );
    if ("error" in segunda) throw new Error(segunda.error);

    const elegivel = await criarNota(destinatario.id_destinatario);
    const semSaldo = await criarNota(destinatario.id_destinatario, {
      esperada: 5,
      entregue: 5,
    });
    const baixaTotal = await criarNota(destinatario.id_destinatario, {
      status: "BAIXA_TOTAL",
    });

    const adicionada = await expedicaoService.adicionarNota(
      primeira.expedicao.id_expedicao,
      elegivel.id_nota_saida,
      usuario.id_usuario,
    );
    expect("error" in adicionada).toBe(false);

    const duplicada = await expedicaoService.adicionarNota(
      segunda.expedicao.id_expedicao,
      elegivel.id_nota_saida,
      usuario.id_usuario,
    );
    expect("error" in duplicada).toBe(true);
    if ("error" in duplicada) {
      expect(duplicada.error).toContain("não elegível");
    }

    const semSaldoResultado = await expedicaoService.adicionarNota(
      segunda.expedicao.id_expedicao,
      semSaldo.id_nota_saida,
      usuario.id_usuario,
    );
    expect("error" in semSaldoResultado).toBe(true);

    const baixaTotalResultado = await expedicaoService.adicionarNota(
      segunda.expedicao.id_expedicao,
      baixaTotal.id_nota_saida,
      usuario.id_usuario,
    );
    expect("error" in baixaTotalResultado).toBe(true);

    const elegiveis = await expedicaoDAO.listNotasElegiveis({ limit: 100 });
    expect(
      elegiveis.data.map((nota) => nota.id_nota_saida),
    ).not.toContain(elegivel.id_nota_saida);
    expect(
      elegiveis.data.map((nota) => nota.id_nota_saida),
    ).not.toContain(semSaldo.id_nota_saida);
    expect(
      elegiveis.data.map((nota) => nota.id_nota_saida),
    ).not.toContain(baixaTotal.id_nota_saida);
  });

  it("reordena 1..N, remove nota e renumera o restante", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();
    const notas = [
      await criarNota(destinatario.id_destinatario),
      await criarNota(destinatario.id_destinatario),
      await criarNota(destinatario.id_destinatario),
    ];

    const criada = await expedicaoService.criar({}, usuario.id_usuario);
    if ("error" in criada) throw new Error(criada.error);
    const idExpedicao = criada.expedicao.id_expedicao;

    for (const nota of notas) {
      const adicionada = await expedicaoService.adicionarNota(
        idExpedicao,
        nota.id_nota_saida,
        usuario.id_usuario,
      );
      if ("error" in adicionada) throw new Error(adicionada.error);
    }

    const [primeira, segunda, terceira] = notas;
    if (!primeira || !segunda || !terceira) {
      throw new Error("notas não criadas");
    }

    const reordenada = await expedicaoService.moverOrdem(
      idExpedicao,
      [terceira.id_nota_saida, primeira.id_nota_saida, segunda.id_nota_saida],
      usuario.id_usuario,
    );
    if ("error" in reordenada) throw new Error(reordenada.error);

    let vinculos = await prismaTeste.expedicaoNota.findMany({
      where: { id_expedicao: idExpedicao },
      orderBy: { ordem_visita: "asc" },
    });
    expect(
      vinculos.map((vinculo) => ({
        id_nota_saida: vinculo.id_nota_saida,
        ordem_visita: vinculo.ordem_visita,
      })),
    ).toEqual([
      { id_nota_saida: terceira.id_nota_saida, ordem_visita: 1 },
      { id_nota_saida: primeira.id_nota_saida, ordem_visita: 2 },
      { id_nota_saida: segunda.id_nota_saida, ordem_visita: 3 },
    ]);

    const removida = await expedicaoService.removerNota(
      idExpedicao,
      primeira.id_nota_saida,
      usuario.id_usuario,
    );
    if ("error" in removida) throw new Error(removida.error);

    vinculos = await prismaTeste.expedicaoNota.findMany({
      where: { id_expedicao: idExpedicao },
      orderBy: { ordem_visita: "asc" },
    });
    expect(
      vinculos.map((vinculo) => ({
        id_nota_saida: vinculo.id_nota_saida,
        ordem_visita: vinculo.ordem_visita,
      })),
    ).toEqual([
      { id_nota_saida: terceira.id_nota_saida, ordem_visita: 1 },
      { id_nota_saida: segunda.id_nota_saida, ordem_visita: 2 },
    ]);

    // A nota removida continua existindo; só o vínculo foi desfeito.
    expect(
      await prismaTeste.notaSaida.findUnique({
        where: { id_nota_saida: primeira.id_nota_saida },
      }),
    ).not.toBeNull();

    const auditorias = await auditoriasDe("Expedicao", idExpedicao);
    expect(
      auditorias.filter((auditoria) => auditoria.acao === "ALTERAR").length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("despacha a expedição, as notas e o veículo; recusa sem nota ou sem veículo", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();
    const veiculo = await criarVeiculo({ status: "DISPONIVEL" });

    const semVeiculo = await expedicaoService.criar({}, usuario.id_usuario);
    if ("error" in semVeiculo) throw new Error(semVeiculo.error);
    const notaSemVeiculo = await criarNota(destinatario.id_destinatario);
    await expedicaoService.adicionarNota(
      semVeiculo.expedicao.id_expedicao,
      notaSemVeiculo.id_nota_saida,
      usuario.id_usuario,
    );

    const recusaSemVeiculo = await expedicaoService.despachar(
      semVeiculo.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    expect("error" in recusaSemVeiculo).toBe(true);
    if ("error" in recusaSemVeiculo) {
      expect(recusaSemVeiculo.error).toContain("veículo");
    }

    const semNota = await expedicaoService.criar(
      { id_veiculo: veiculo.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in semNota) throw new Error(semNota.error);

    const recusaSemNota = await expedicaoService.despachar(
      semNota.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    expect("error" in recusaSemNota).toBe(true);
    if ("error" in recusaSemNota) {
      expect(recusaSemNota.error).toContain("nota");
    }

    const pronta = await expedicaoService.criar(
      { id_veiculo: veiculo.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in pronta) throw new Error(pronta.error);
    const nota = await criarNota(destinatario.id_destinatario);
    const adicionada = await expedicaoService.adicionarNota(
      pronta.expedicao.id_expedicao,
      nota.id_nota_saida,
      usuario.id_usuario,
    );
    if ("error" in adicionada) throw new Error(adicionada.error);

    const despachada = await expedicaoService.despachar(
      pronta.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    if ("error" in despachada) throw new Error(despachada.error);

    const expedicao = await prismaTeste.expedicao.findUniqueOrThrow({
      where: { id_expedicao: pronta.expedicao.id_expedicao },
    });
    const notaDespachada = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: nota.id_nota_saida },
    });
    const veiculoDespachado = await prismaTeste.veiculo.findUniqueOrThrow({
      where: { id_veiculo: veiculo.id_veiculo },
    });

    expect(expedicao.status).toBe("EM_PERCURSO");
    expect(notaDespachada.status).toBe("EM_PERCURSO");
    expect(veiculoDespachado.status).toBe("EM_EXPEDICAO");

    const auditorias = await auditoriasDe(
      "Expedicao",
      pronta.expedicao.id_expedicao,
    );
    const despacho = auditorias[auditorias.length - 1];
    expect(despacho?.acao).toBe("ALTERAR");
    expect(despacho?.dados_anteriores).toMatchObject({
      status: "PLANEJADA",
      notas: [{ id_nota_saida: nota.id_nota_saida, status: "ABERTA" }],
    });
    expect(despacho?.dados_novos).toMatchObject({
      status: "EM_PERCURSO",
      notas: [{ id_nota_saida: nota.id_nota_saida, status: "EM_PERCURSO" }],
    });
  });

  it("recusa despachar com veículo indisponível ou já em outra expedição em percurso", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();

    const indisponivel = await criarVeiculo({ status: "INDISPONIVEL" });
    const expedicaoIndisponivel = await expedicaoService.criar(
      { id_veiculo: indisponivel.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in expedicaoIndisponivel) {
      throw new Error(expedicaoIndisponivel.error);
    }
    const notaIndisponivel = await criarNota(destinatario.id_destinatario);
    const adicionadaIndisponivel = await expedicaoService.adicionarNota(
      expedicaoIndisponivel.expedicao.id_expedicao,
      notaIndisponivel.id_nota_saida,
      usuario.id_usuario,
    );
    if ("error" in adicionadaIndisponivel) {
      throw new Error(adicionadaIndisponivel.error);
    }

    const recusaIndisponivel = await expedicaoService.despachar(
      expedicaoIndisponivel.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    expect("error" in recusaIndisponivel).toBe(true);
    if ("error" in recusaIndisponivel) {
      expect(recusaIndisponivel.error).toContain("indisponível");
    }

    const veiculo = await criarVeiculo({ status: "DISPONIVEL" });
    const primeira = await expedicaoService.criar(
      { id_veiculo: veiculo.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in primeira) throw new Error(primeira.error);
    const primeiraNota = await criarNota(destinatario.id_destinatario);
    await expedicaoService.adicionarNota(
      primeira.expedicao.id_expedicao,
      primeiraNota.id_nota_saida,
      usuario.id_usuario,
    );
    const despachada = await expedicaoService.despachar(
      primeira.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    if ("error" in despachada) throw new Error(despachada.error);

    // O mesmo veículo agora está em uma expedição EM_PERCURSO.
    const segunda = await expedicaoService.criar(
      { id_veiculo: veiculo.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in segunda) throw new Error(segunda.error);
    const segundaNota = await criarNota(destinatario.id_destinatario);
    const adicionadaSegunda = await expedicaoService.adicionarNota(
      segunda.expedicao.id_expedicao,
      segundaNota.id_nota_saida,
      usuario.id_usuario,
    );
    if ("error" in adicionadaSegunda) {
      throw new Error(adicionadaSegunda.error);
    }

    const recusaEmPercurso = await expedicaoService.despachar(
      segunda.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    expect("error" in recusaEmPercurso).toBe(true);
    if ("error" in recusaEmPercurso) {
      expect(recusaEmPercurso.error).toContain(
        "Veículo já está em outra expedição em percurso.",
      );
    }

    const segundaDepois = await prismaTeste.expedicao.findUniqueOrThrow({
      where: { id_expedicao: segunda.expedicao.id_expedicao },
    });
    expect(segundaDepois.status).toBe("PLANEJADA");
  });

  it("desativa só expedição planejada, preserva o vínculo e registra auditoria", async () => {
    const { usuario } = await criarUsuario();
    const { destinatario } = await criarDestinatario();
    const nota = await criarNota(destinatario.id_destinatario);

    const criada = await expedicaoService.criar({}, usuario.id_usuario);
    if ("error" in criada) throw new Error(criada.error);
    const idExpedicao = criada.expedicao.id_expedicao;
    await expedicaoService.adicionarNota(
      idExpedicao,
      nota.id_nota_saida,
      usuario.id_usuario,
    );

    const desativada = await expedicaoService.desativar(
      idExpedicao,
      usuario.id_usuario,
    );
    expect("error" in desativada).toBe(false);

    const expedicao = await prismaTeste.expedicao.findUniqueOrThrow({
      where: { id_expedicao: idExpedicao },
    });
    expect(expedicao.ativo).toBe(false);
    expect(await expedicaoDAO.getById(idExpedicao)).toBeNull();

    // Nada foi apagado: o vínculo e a nota continuam no banco.
    expect(
      await prismaTeste.expedicaoNota.count({
        where: { id_expedicao: idExpedicao },
      }),
    ).toBe(1);
    expect(
      await prismaTeste.notaSaida.findUnique({
        where: { id_nota_saida: nota.id_nota_saida },
      }),
    ).not.toBeNull();

    const auditorias = await auditoriasDe("Expedicao", idExpedicao);
    expect(auditorias[auditorias.length - 1]?.acao).toBe("DESATIVAR");
    expect(auditorias[auditorias.length - 1]?.dados_anteriores).toMatchObject({
      ativo: true,
    });
    expect(auditorias[auditorias.length - 1]?.dados_novos).toMatchObject({
      ativo: false,
    });

    const segundaVez = await expedicaoService.desativar(
      idExpedicao,
      usuario.id_usuario,
    );
    expect("error" in segundaVez).toBe(true);

    // Depois de despachada, não pode ser desativada.
    const veiculo = await criarVeiculo();
    const despachavel = await expedicaoService.criar(
      { id_veiculo: veiculo.id_veiculo },
      usuario.id_usuario,
    );
    if ("error" in despachavel) throw new Error(despachavel.error);
    const outraNota = await criarNota(destinatario.id_destinatario);
    await expedicaoService.adicionarNota(
      despachavel.expedicao.id_expedicao,
      outraNota.id_nota_saida,
      usuario.id_usuario,
    );
    const despacho = await expedicaoService.despachar(
      despachavel.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    if ("error" in despacho) throw new Error(despacho.error);

    const recusa = await expedicaoService.desativar(
      despachavel.expedicao.id_expedicao,
      usuario.id_usuario,
    );
    expect("error" in recusa).toBe(true);
  });
});

describe("expedicaoService — execução da entrega", () => {
  it("entrega total dá baixa em quantidade_atual e saldo_reservado, com movimentação negativa", async () => {
    const ctx = await montarEntregaEmPercurso([10]);

    const resultado = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [10]) },
      ctx.usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.entrega.status).toBe("BAIXA_TOTAL");

    const estoque = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[0]!.id_estoque },
    });
    expect(estoque.quantidade_atual).toBe(90);
    expect(estoque.saldo_reservado).toBe(0);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(movimentacoes).toHaveLength(1);
    expect(movimentacoes[0]?.quantidade).toBe(-10);
    expect(movimentacoes[0]?.saldo_anterior).toBe(100);
    expect(movimentacoes[0]?.saldo_posterior).toBe(90);

    const item = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: ctx.itens[0]!.id_item_nota_saida },
    });
    expect(item.qtd_entregue).toBe(10);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(nota.status).toBe("BAIXA_TOTAL");

    const auditorias = await auditoriasDe("NotaSaida", ctx.nota.id_nota_saida);
    expect(auditorias.at(-1)?.acao).toBe("ALTERAR");
    expect(auditorias.at(-1)?.dados_anteriores).toMatchObject({
      status: "EM_PERCURSO",
      itens: [{ qtd_entregue: 0 }],
    });
    expect(auditorias.at(-1)?.dados_novos).toMatchObject({
      status: "BAIXA_TOTAL",
      itens: [{ qtd_entregue: 10 }],
    });
  });

  it("entrega parcial sem corte baixa só o entregue e mantém o restante reservado e elegível", async () => {
    const ctx = await montarEntregaEmPercurso([10]);

    const resultado = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [6]) },
      ctx.usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.entrega.status).toBe("BAIXA_PARCIAL");

    const estoque = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[0]!.id_estoque },
    });
    expect(estoque.quantidade_atual).toBe(94);
    expect(estoque.saldo_reservado).toBe(4);

    const item = await prismaTeste.itemNotaSaida.findUniqueOrThrow({
      where: { id_item_nota_saida: ctx.itens[0]!.id_item_nota_saida },
    });
    expect(item.qtd_entregue).toBe(6);

    // O restante só volta a ser elegível quando a expedição deixa de estar ativa.
    const concluida = await expedicaoService.concluir(
      ctx.expedicao.id_expedicao,
      ctx.usuario.id_usuario,
    );
    if ("error" in concluida) throw new Error(concluida.error);

    const elegiveis = await expedicaoDAO.listNotasElegiveis({ limit: 100 });
    expect(elegiveis.data.map((nota) => nota.id_nota_saida)).toContain(
      ctx.nota.id_nota_saida,
    );
  });

  it("entrega parcial com corte baixa o entregue e libera a reserva do restante", async () => {
    const ctx = await montarEntregaEmPercurso([10, 20]);

    const resultado = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [6, 20]), cortar_restante: true },
      ctx.usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.entrega.status).toBe("BAIXA_COM_CORTE");

    const primeiro = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[0]!.id_estoque },
    });
    expect(primeiro.quantidade_atual).toBe(94);
    expect(primeiro.saldo_reservado).toBe(0);

    const segundo = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[1]!.id_estoque },
    });
    expect(segundo.quantidade_atual).toBe(80);
    expect(segundo.saldo_reservado).toBe(0);

    // O corte do restante do primeiro item gera reserva negativa, sem baixa de
    // quantidade_atual.
    const liberacoes = await prismaTeste.reservaEstoque.findMany({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(liberacoes).toHaveLength(1);
    expect(liberacoes[0]?.quantidade).toBe(-4);

    const movimentacoes = await prismaTeste.movimentacaoEstoque.findMany({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(movimentacoes.map((movimentacao) => movimentacao.quantidade).sort(
      (a, b) => a - b,
    )).toEqual([-20, -6]);
  });

  it("não entregue vai para PENDENTE sem alterar estoque nem reserva", async () => {
    const ctx = await montarEntregaEmPercurso([10]);

    const resultado = await expedicaoService.marcarNaoEntregue(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      ctx.usuario.id_usuario,
    );
    if ("error" in resultado) throw new Error(resultado.error);

    expect(resultado.entrega.status).toBe("PENDENTE");

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(nota.status).toBe("PENDENTE");

    const estoque = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[0]!.id_estoque },
    });
    expect(estoque.quantidade_atual).toBe(100);
    expect(estoque.saldo_reservado).toBe(10);

    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_saida: ctx.nota.id_nota_saida },
      }),
    ).toBe(0);
  });

  it("concluir marca as notas restantes como PENDENTE, conclui a expedição e libera o veículo", async () => {
    const ctx = await montarEntregaEmPercurso([10]);

    // Segunda nota, ainda em percurso, para ser marcada como pendente.
    const produto = await criarProduto();
    const estoque = await criarEstoque(produto.id_produto, {
      quantidadeAtual: 50,
      saldoReservado: 5,
    });
    const notaLivre = await criarNotaSaida();
    await criarItemNotaSaida(notaLivre.id_nota_saida, estoque.id_estoque, 5);
    await prismaTeste.expedicaoNota.create({
      data: {
        id_expedicao: ctx.expedicao.id_expedicao,
        id_nota_saida: notaLivre.id_nota_saida,
        ordem_visita: 2,
        data_adicao: new Date(),
      },
    });
    await prismaTeste.notaSaida.update({
      where: { id_nota_saida: notaLivre.id_nota_saida },
      data: { status: "EM_PERCURSO" },
    });

    const entrega = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [10]) },
      ctx.usuario.id_usuario,
    );
    if ("error" in entrega) throw new Error(entrega.error);

    const conclusao = await expedicaoService.concluir(
      ctx.expedicao.id_expedicao,
      ctx.usuario.id_usuario,
    );
    if ("error" in conclusao) throw new Error(conclusao.error);

    const expedicao = await prismaTeste.expedicao.findUniqueOrThrow({
      where: { id_expedicao: ctx.expedicao.id_expedicao },
    });
    expect(expedicao.status).toBe("CONCLUIDA");

    const pendente = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: notaLivre.id_nota_saida },
    });
    expect(pendente.status).toBe("PENDENTE");

    const entregue = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: ctx.nota.id_nota_saida },
    });
    expect(entregue.status).toBe("BAIXA_TOTAL");

    const veiculo = await prismaTeste.veiculo.findUniqueOrThrow({
      where: { id_veiculo: ctx.veiculo.id_veiculo },
    });
    expect(veiculo.status).toBe("DISPONIVEL");

    const auditorias = await auditoriasDe(
      "Expedicao",
      ctx.expedicao.id_expedicao,
    );
    const conclusaoAuditada = auditorias.at(-1);
    expect(conclusaoAuditada?.acao).toBe("ALTERAR");
    expect(conclusaoAuditada?.dados_anteriores).toMatchObject({
      status: "EM_PERCURSO",
    });
    expect(conclusaoAuditada?.dados_novos).toMatchObject({
      status: "CONCLUIDA",
      notas_marcadas_pendentes: 1,
    });
  });

  it("recusa a segunda baixa na mesma nota sem debitar de novo", async () => {
    const ctx = await montarEntregaEmPercurso([10]);

    const primeira = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [10]) },
      ctx.usuario.id_usuario,
    );
    if ("error" in primeira) throw new Error(primeira.error);

    const segunda = await expedicaoService.registrarEntrega(
      ctx.expedicao.id_expedicao,
      ctx.nota.id_nota_saida,
      { itens: entregaDe(ctx.itens, [10]) },
      ctx.usuario.id_usuario,
    );
    expect("error" in segunda).toBe(true);

    const estoque = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: ctx.estoques[0]!.id_estoque },
    });
    expect(estoque.quantidade_atual).toBe(90);
    expect(estoque.saldo_reservado).toBe(0);
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_saida: ctx.nota.id_nota_saida },
      }),
    ).toBe(1);
  });

  it("não bloqueia por quantidade_atual insuficiente, mas aborta se a reserva não cobre", async () => {
    // RN001: divergência de inventário não impede registrar uma entrega real.
    const divergente = await montarEntregaEmPercurso([10], {
      quantidadeAtual: 2,
    });

    const entrega = await expedicaoService.registrarEntrega(
      divergente.expedicao.id_expedicao,
      divergente.nota.id_nota_saida,
      { itens: entregaDe(divergente.itens, [10]) },
      divergente.usuario.id_usuario,
    );
    if ("error" in entrega) throw new Error(entrega.error);

    const estoqueDivergente = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: divergente.estoques[0]!.id_estoque },
    });
    expect(estoqueDivergente.quantidade_atual).toBe(-8);
    expect(estoqueDivergente.saldo_reservado).toBe(0);

    // Reserva menor que o entregue: transação abortada, nada muda.
    const semReserva = await montarEntregaEmPercurso([10], {
      saldoReservado: [4],
    });

    const recusada = await expedicaoService.registrarEntrega(
      semReserva.expedicao.id_expedicao,
      semReserva.nota.id_nota_saida,
      { itens: entregaDe(semReserva.itens, [10]) },
      semReserva.usuario.id_usuario,
    );
    expect("error" in recusada).toBe(true);
    if ("error" in recusada) {
      expect(recusada.error).toContain("Saldo reservado insuficiente");
    }

    const estoqueSemReserva = await prismaTeste.estoque.findUniqueOrThrow({
      where: { id_estoque: semReserva.estoques[0]!.id_estoque },
    });
    expect(estoqueSemReserva.quantidade_atual).toBe(100);
    expect(estoqueSemReserva.saldo_reservado).toBe(4);

    const nota = await prismaTeste.notaSaida.findUniqueOrThrow({
      where: { id_nota_saida: semReserva.nota.id_nota_saida },
    });
    expect(nota.status).toBe("EM_PERCURSO");
    expect(
      await prismaTeste.movimentacaoEstoque.count({
        where: { id_nota_saida: semReserva.nota.id_nota_saida },
      }),
    ).toBe(0);
  });
});
