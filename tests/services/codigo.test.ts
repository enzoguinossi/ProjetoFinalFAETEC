import { describe, expect, it } from "vitest";
import { codigoService } from "@/services/codigo";
import { criarTipoCodigo } from "../helpers/factories";

function formComCodigos(entradas: { tipo: string; valor: string }[]) {
  const fd = new FormData();
  fd.set("codigos", JSON.stringify(entradas));
  return fd;
}

describe("codigoService.resolverCodigosParaSalvar", () => {
  it("resolve o id do tipo para um código válido", async () => {
    const tipo = await criarTipoCodigo("DIGITACAO");

    const resultado = await codigoService.resolverCodigosParaSalvar(
      "PRODUTO",
      formComCodigos([{ tipo: "DIGITACAO", valor: "  ABC  " }]),
    );

    expect(resultado).toEqual({ codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ABC" }] });
  });

  it("retorna lista vazia quando não há valores", async () => {
    const resultado = await codigoService.resolverCodigosParaSalvar(
      "PRODUTO",
      formComCodigos([{ tipo: "DIGITACAO", valor: "   " }]),
    );

    expect(resultado).toEqual({ codigos: [] });
  });

  it("rejeita tipo não permitido para a entidade", async () => {
    await criarTipoCodigo("MATRICULA");

    const resultado = await codigoService.resolverCodigosParaSalvar(
      "PRODUTO",
      formComCodigos([{ tipo: "MATRICULA", valor: "123" }]),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("não é permitido") });
  });

  it("rejeita valor inválido para o tipo (EAN13)", async () => {
    await criarTipoCodigo("EAN13");

    const resultado = await codigoService.resolverCodigosParaSalvar(
      "PRODUTO",
      formComCodigos([{ tipo: "EAN13", valor: "123" }]),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("EAN13") });
  });

  it("rejeita tipo permitido que não existe no banco", async () => {
    const resultado = await codigoService.resolverCodigosParaSalvar(
      "DESTINATARIO",
      formComCodigos([{ tipo: "COD_ESCOLA", valor: "ESC-1" }]),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("não encontrado") });
  });

  it("trata JSON inválido ou ausente como lista vazia", async () => {
    const invalido = new FormData();
    invalido.set("codigos", "{quebrado");
    expect(await codigoService.resolverCodigosParaSalvar("PRODUTO", invalido)).toEqual({ codigos: [] });
    expect(await codigoService.resolverCodigosParaSalvar("PRODUTO", new FormData())).toEqual({ codigos: [] });
  });

  it("rejeita payload com formato inesperado", async () => {
    const naoArray = new FormData();
    naoArray.set("codigos", JSON.stringify({ tipo: "DIGITACAO", valor: "X" }));
    expect(await codigoService.resolverCodigosParaSalvar("PRODUTO", naoArray)).toEqual({
      error: "Dados de códigos inválidos.",
    });

    const itemInvalido = new FormData();
    itemInvalido.set("codigos", JSON.stringify([{ tipo: "DIGITACAO" }]));
    expect(await codigoService.resolverCodigosParaSalvar("PRODUTO", itemInvalido)).toEqual({
      error: "Dados de códigos inválidos.",
    });
  });
});
