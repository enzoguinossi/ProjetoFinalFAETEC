import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultarCnpjBrasilApi, limparCacheCnpj } from "@/services/consulta-cnpj";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const CNPJ_VALIDO = "19131243000197";

const RESPOSTA_BRASILAPI = {
  cnpj: CNPJ_VALIDO,
  razao_social: "OPEN KNOWLEDGE BRASIL",
  nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
  descricao_situacao_cadastral: "ATIVA",
  cep: "01311902",
  descricao_tipo_de_logradouro: "AVENIDA",
  logradouro: "PAULISTA",
  numero: "37",
  complemento: "ANDAR 4",
  bairro: "BELA VISTA",
  municipio: "SAO PAULO",
  uf: "SP",
  email: "contato@ok.org.br",
  ddd_telefone_1: "1123851939",
};

function respostaHttp(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  limparCacheCnpj();
});

describe("consultarCnpjBrasilApi", () => {
  it("consulta a BrasilAPI com User-Agent próprio e mapeia os dados", async () => {
    fetchMock.mockResolvedValue(respostaHttp(200, RESPOSTA_BRASILAPI));

    const resultado = await consultarCnpjBrasilApi(CNPJ_VALIDO);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://brasilapi.com.br/api/cnpj/v1/${CNPJ_VALIDO}`);
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      "User-Agent": "Nexus/3.24.10.2026 (+https://github.com/enzoguinossi/ProjetoFinalFAETEC)",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(resultado).toEqual({
      empresa: {
        cnpj: CNPJ_VALIDO,
        razao_social: "OPEN KNOWLEDGE BRASIL",
        nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
        situacao: "ATIVA",
        endereco: {
          cep: "01311-902",
          logradouro: "AVENIDA PAULISTA",
          numero: "37",
          complemento: "ANDAR 4",
          bairro: "BELA VISTA",
          cidade: "SAO PAULO",
          uf: "SP",
        },
        email: "contato@ok.org.br",
        telefone: "1123851939",
      },
    });
  });

  it("remove o número repetido no logradouro sem duplicar o campo Número", async () => {
    fetchMock.mockResolvedValue(
      respostaHttp(200, {
        ...RESPOSTA_BRASILAPI,
        logradouro: "PAULISTA 37",
        numero: "37",
      }),
    );

    const resultado = await consultarCnpjBrasilApi(CNPJ_VALIDO);

    expect(resultado).toHaveProperty("empresa.endereco.logradouro", "AVENIDA PAULISTA");
    expect(resultado).toHaveProperty("empresa.endereco.numero", "37");
  });

  it("normaliza campos ausentes para null", async () => {
    fetchMock.mockResolvedValue(
      respostaHttp(200, {
        cnpj: CNPJ_VALIDO,
        razao_social: "SEM DADOS",
        nome_fantasia: "",
        descricao_situacao_cadastral: null,
        cep: null,
        descricao_tipo_de_logradouro: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        municipio: null,
        uf: null,
        email: null,
        ddd_telefone_1: "",
      }),
    );

    const resultado = await consultarCnpjBrasilApi(CNPJ_VALIDO);

    expect(resultado).toEqual({
      empresa: {
        cnpj: CNPJ_VALIDO,
        razao_social: "SEM DADOS",
        nome_fantasia: null,
        situacao: null,
        endereco: {
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: null,
          uf: null,
        },
        email: null,
        telefone: null,
      },
    });
  });

  it("recusa CNPJ inválido antes de chamar a API", async () => {
    const resultado = await consultarCnpjBrasilApi("123");

    expect(resultado).toEqual({ error: "CNPJ deve conter 14 dígitos." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapeia 404 para CNPJ não encontrado", async () => {
    fetchMock.mockResolvedValue(respostaHttp(404));

    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toEqual({
      error: "CNPJ não encontrado na Receita.",
    });
  });

  it.each([403, 429])("mapeia %i para indisponibilidade temporária", async (status) => {
    fetchMock.mockResolvedValue(respostaHttp(status));

    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toEqual({
      error: "Consulta de CNPJ temporariamente indisponível. Tente novamente.",
    });
  });

  it("mapeia 500 para mensagem genérica", async () => {
    fetchMock.mockResolvedValue(respostaHttp(500));

    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toEqual({
      error: "Não foi possível consultar o CNPJ. Tente novamente.",
    });
  });

  it("mapeia timeout para mensagem genérica", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toEqual({
      error: "Não foi possível consultar o CNPJ. Tente novamente.",
    });
  });

  it("usa cache de 1 h por CNPJ e só guarda sucesso", async () => {
    fetchMock.mockResolvedValueOnce(respostaHttp(200, RESPOSTA_BRASILAPI));
    await consultarCnpjBrasilApi(CNPJ_VALIDO, { agora: 1_000 });

    await consultarCnpjBrasilApi(CNPJ_VALIDO, { agora: 1_000 + 60 * 60 * 1000 - 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(respostaHttp(200, RESPOSTA_BRASILAPI));
    await consultarCnpjBrasilApi(CNPJ_VALIDO, { agora: 1_000 + 60 * 60 * 1000 + 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não guarda erro no cache", async () => {
    fetchMock.mockResolvedValueOnce(respostaHttp(500));
    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toHaveProperty("error");

    fetchMock.mockResolvedValueOnce(respostaHttp(200, RESPOSTA_BRASILAPI));
    expect(await consultarCnpjBrasilApi(CNPJ_VALIDO)).toHaveProperty("empresa");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
