import cep from "cep-promise";
import { isUF, type UF } from "@/lib/uf";

export type EnderecoCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: UF | "";
};

export type ResultadoCep = { endereco: EnderecoCep } | { error: string };

// Providers disponíveis também no browser (correios* são Node-only).
const PROVIDERS = ["brasilapi", "viacep", "widenet"] as const;

export class CepService {
  /**
   * Busca um CEP no cep-promise e normaliza a resposta para os campos
   * usados pelo model Endereco. Não lança: retorna { error } em falhas.
   */
  async buscarEnderecoPorCep(valor: string): Promise<ResultadoCep> {
    const cepNumerico = (valor ?? "").replace(/\D/g, "");

    if (cepNumerico.length !== 8) {
      return { error: "CEP deve conter exatamente 8 dígitos." };
    }

    try {
      const data = await cep(cepNumerico, {
        providers: [...PROVIDERS],
        timeout: 5000,
      });

      return {
        endereco: {
          cep: data.cep,
          logradouro: data.street ?? "",
          bairro: data.neighborhood ?? "",
          cidade: data.city ?? "",
          uf: isUF(data.state) ? data.state : "",
        },
      };
    } catch (e) {
      const err = e as { type?: string; message?: string };
      if (err?.type === "validation_error") {
        return { error: "CEP em formato inválido." };
      }
      return { error: "Não foi possível encontrar o CEP informado." };
    }
  }
}

export const cepService = new CepService();
