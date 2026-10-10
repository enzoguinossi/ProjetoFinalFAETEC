import { describe, expect, it } from "vitest";
import { codigoService } from "@/services/codigo";
import { criarTipoCodigo } from "../helpers/factories";

function formComCodigos(entradas: { tipo: string; valor: string }[]) {
  const fd = new FormData();
  for (const e of entradas) {
    fd.append("codigo_tipo", e.tipo);
    fd.append("codigo_valor", e.valor);
  }
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
});
