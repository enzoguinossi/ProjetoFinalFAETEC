import { beforeEach, describe, expect, it, vi } from "vitest";
import { cepService } from "@/services/cep";

const { buscarMock } = vi.hoisted(() => ({ buscarMock: vi.fn() }));

vi.mock("cep-promise", () => ({ default: buscarMock }));

beforeEach(() => {
  buscarMock.mockReset();
});

describe("cepService.buscarEnderecoPorCep", () => {
  it("rejeita CEP com quantidade de dígitos diferente de 8 sem consultar o provedor", async () => {
    const resultado = await cepService.buscarEnderecoPorCep("123");

    expect(resultado).toEqual({ error: "CEP deve conter exatamente 8 dígitos." });
    expect(buscarMock).not.toHaveBeenCalled();
  });

  it("normaliza a resposta do provedor", async () => {
    buscarMock.mockResolvedValue({
      cep: "20040-002",
      street: "Rua da Assembleia",
      neighborhood: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    });

    const resultado = await cepService.buscarEnderecoPorCep("20040-002");

    expect(buscarMock).toHaveBeenCalledWith("20040002", expect.objectContaining({ timeout: 5000 }));
    expect(resultado).toEqual({
      endereco: {
        cep: "20040-002",
        logradouro: "Rua da Assembleia",
        bairro: "Centro",
        cidade: "Rio de Janeiro",
        uf: "RJ",
      },
    });
  });

  it("usa string vazia para campos ausentes e UF inválida", async () => {
    buscarMock.mockResolvedValue({ cep: "99999999", state: "XX" });

    const resultado = await cepService.buscarEnderecoPorCep("99999999");

    expect(resultado).toEqual({
      endereco: {
        cep: "99999999",
        logradouro: "",
        bairro: "",
        cidade: "",
        uf: "",
      },
    });
  });

  it("mapeia erro de validação do provedor", async () => {
    buscarMock.mockRejectedValue({ type: "validation_error" });

    expect(await cepService.buscarEnderecoPorCep("00000000")).toEqual({
      error: "CEP em formato inválido.",
    });
  });

  it("mapeia falha genérica do provedor", async () => {
    buscarMock.mockRejectedValue(new Error("network"));

    expect(await cepService.buscarEnderecoPorCep("20040002")).toEqual({
      error: "Não foi possível encontrar o CEP informado.",
    });
  });
});
