import { describe, expect, it } from "vitest";
import {
  faixaDeValidade,
  gerarAlertasValidade,
} from "@/services/alerta-validade";
import { formatarCodigo } from "@/lib/formatar";
import { prismaTeste } from "../helpers/prisma";
import { criarProduto } from "../helpers/factories";

const AGORA = new Date("2026-10-25T15:00:00.000Z"); // 12:00 em São Paulo

/** Data `DATE` (meia-noite UTC), `dias` depois de 25/10/2026. */
function validadeEmDias(dias: number) {
  return new Date(Date.UTC(2026, 9, 25) + dias * 24 * 60 * 60 * 1000);
}

async function ativas() {
  return prismaTeste.mensagemMural.findMany({
    where: { ativo: true },
    orderBy: { id_mensagem_mural: "asc" },
  });
}

describe("faixaDeValidade", () => {
  it.each([
    [120, null],
    [91, null],
    [90, 90],
    [61, 90],
    [60, 60],
    [46, 60],
    [45, 45],
    [31, 45],
    [30, 30],
    [1, 30],
    [0, null],
    [-5, null],
  ])("dias=%i → faixa %s", (dias, esperado) => {
    expect(faixaDeValidade(dias)).toBe(esperado);
  });
});

describe("gerarAlertasValidade", () => {
  it("cria uma mensagem automática ativa por produto na faixa de 90 dias", async () => {
    const produto = await criarProduto({
      descricao: "Leite integral",
      perecivel: true,
      dataValidade: validadeEmDias(80),
    });

    await gerarAlertasValidade(AGORA);

    const lista = await ativas();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      automatica: true,
      id_usuario: null,
      titulo: "Validade",
      chave: `validade:${produto.id_produto}:90`,
    });
    expect(lista[0]?.conteudo).toContain("Leite integral");
    expect(lista[0]?.conteudo).toContain(formatarCodigo(produto.id_produto));
    expect(lista[0]?.conteudo).toContain("vence em 80 dias");
    expect(lista[0]?.conteudo).toContain("13/01/2027");
    expect(lista[0]?.data_expiracao?.toISOString()).toBe(
      "2027-01-14T02:59:59.000Z",
    );
  });

  it("é idempotente: rodar de novo não duplica a mensagem", async () => {
    await criarProduto({
      perecivel: true,
      dataValidade: validadeEmDias(75),
    });

    await gerarAlertasValidade(AGORA);
    const primeira = await ativas();
    await gerarAlertasValidade(AGORA);
    const segunda = await ativas();

    expect(segunda).toHaveLength(1);
    expect(segunda[0]?.id_mensagem_mural).toBe(primeira[0]?.id_mensagem_mural);
    expect(await prismaTeste.mensagemMural.count()).toBe(1);
  });

  it("ao mudar de faixa, desativa a anterior e preserva o histórico", async () => {
    const produto = await criarProduto({
      perecivel: true,
      dataValidade: validadeEmDias(80),
    });

    await gerarAlertasValidade(AGORA);
    await prismaTeste.produto.update({
      where: { id_produto: produto.id_produto },
      data: { data_validade: validadeEmDias(50) },
    });
    await gerarAlertasValidade(AGORA);

    const lista = await ativas();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      chave: `validade:${produto.id_produto}:60`,
      ativo: true,
    });

    const historico = await prismaTeste.mensagemMural.findMany({
      where: { ativo: false },
    });
    expect(historico).toHaveLength(1);
    expect(historico[0]?.chave).toBeNull();
    expect(historico[0]?.conteudo).toContain("vence em 80 dias");
    expect(await prismaTeste.mensagemMural.count()).toBe(2);
  });

  it("produto vencido não mantém mensagem ativa, mas o histórico permanece", async () => {
    const produto = await criarProduto({
      perecivel: true,
      dataValidade: validadeEmDias(20),
    });

    await gerarAlertasValidade(AGORA);
    expect(await ativas()).toHaveLength(1);

    await prismaTeste.produto.update({
      where: { id_produto: produto.id_produto },
      data: { data_validade: validadeEmDias(-1) },
    });
    await gerarAlertasValidade(AGORA);

    expect(await ativas()).toHaveLength(0);
    expect(await prismaTeste.mensagemMural.count()).toBe(1);
  });

  it("produto inativo desativa a mensagem ativa", async () => {
    const produto = await criarProduto({
      perecivel: true,
      dataValidade: validadeEmDias(20),
    });

    await gerarAlertasValidade(AGORA);
    await prismaTeste.produto.update({
      where: { id_produto: produto.id_produto },
      data: { ativo: false },
    });
    await gerarAlertasValidade(AGORA);

    expect(await ativas()).toHaveLength(0);
    expect(await prismaTeste.mensagemMural.count()).toBe(1);
  });

  it("não cria mensagem para produto com mais de 90 dias ou não perecível", async () => {
    await criarProduto({
      perecivel: true,
      dataValidade: validadeEmDias(120),
    });
    await criarProduto({
      perecivel: false,
      dataValidade: validadeEmDias(20),
    });

    await gerarAlertasValidade(AGORA);

    expect(await prismaTeste.mensagemMural.count()).toBe(0);
  });

  it("usa o dia civil de São Paulo no limite da faixa", async () => {
    // 23:30 em São Paulo já é o dia seguinte em UTC: a validade em 25/12 é
    // 61 dias civis em São Paulo (faixa 90) e 60 em UTC (faixa 60).
    const referencia = new Date("2026-10-25T23:30:00-03:00");
    const produto = await criarProduto({
      perecivel: true,
      dataValidade: new Date("2026-12-25T00:00:00.000Z"),
    });

    await gerarAlertasValidade(referencia);

    const lista = await ativas();
    expect(lista[0]?.chave).toBe(`validade:${produto.id_produto}:90`);
  });
});
