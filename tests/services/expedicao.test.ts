import { describe, expect, it } from "vitest";
import {
  criarDestinatario,
  criarEstoque,
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
