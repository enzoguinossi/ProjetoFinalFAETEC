import { validarCnpj } from "@/lib/cnpj";

/** Endereço retornado pela consulta de CNPJ. Campos ausentes viram `null`. */
export type EnderecoCnpj = {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export type DadosCnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao: string | null;
  endereco: EnderecoCnpj;
  email: string | null;
  telefone: string | null;
};

export type ResultadoConsultaCnpj = { empresa: DadosCnpj } | { error: string };

const URL_BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1";
const USER_AGENT =
  "Nexus/3.24.10.2026 (+https://github.com/enzoguinossi/ProjetoFinalFAETEC)";
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const MSG_NAO_ENCONTRADO = "CNPJ não encontrado na Receita.";
const MSG_INDISPONIVEL = "Consulta de CNPJ temporariamente indisponível. Tente novamente.";
const MSG_ERRO = "Não foi possível consultar o CNPJ. Tente novamente.";

type RespostaBrasilApi = {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string | null;
  cep?: string | null;
  descricao_tipo_de_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  email?: string | null;
  ddd_telefone_1?: string | null;
};

const cache = new Map<string, { expiraEm: number; empresa: DadosCnpj }>();

/** Limpa o cache da consulta de CNPJ (usado nos testes). */
export function limparCacheCnpj(): void {
  cache.clear();
}

function texto(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const normalizado = valor.trim();
  return normalizado ? normalizado : null;
}

/** Formata 8 dígitos como 00000-000; valores já formatados ou inesperados passam como vieram. */
function formatarCep(valor: string | null | undefined): string | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const digitos = bruto.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : bruto;
}

/**
 * Compõe o logradouro com o tipo. A BrasilAPI às vezes repete o número no próprio
 * `logradouro` (ex.: "PAULISTA 37" + numero "37"); nesse caso o sufixo é removido,
 * já que o número vai para o campo próprio.
 */
function logradouroCompleto(resposta: RespostaBrasilApi): string | null {
  const composto = texto(
    [resposta.descricao_tipo_de_logradouro, resposta.logradouro].filter(Boolean).join(" "),
  );
  if (!composto) return null;

  const numero = texto(resposta.numero);
  if (numero && composto.endsWith(` ${numero}`)) {
    return texto(composto.slice(0, -(numero.length + 1)));
  }
  return composto;
}

export function mapearCnpj(resposta: RespostaBrasilApi, cnpj: string): DadosCnpj {
  return {
    cnpj,
    razao_social: texto(resposta.razao_social) ?? "",
    nome_fantasia: texto(resposta.nome_fantasia),
    situacao: texto(resposta.descricao_situacao_cadastral),
    endereco: {
      cep: formatarCep(resposta.cep),
      logradouro: logradouroCompleto(resposta),
      numero: texto(resposta.numero),
      complemento: texto(resposta.complemento),
      bairro: texto(resposta.bairro),
      cidade: texto(resposta.municipio),
      uf: texto(resposta.uf),
    },
    email: texto(resposta.email),
    telefone: texto(resposta.ddd_telefone_1),
  };
}

/**
 * Consulta os dados cadastrais do CNPJ na BrasilAPI.
 * Valida o CNPJ antes da chamada, usa `User-Agent` próprio (o padrão do Node é
 * bloqueado pela BrasilAPI), timeout de 8 s e cache em memória de 1 h por CNPJ.
 * Não lança: retorna `{ error }` em falhas.
 */
export async function consultarCnpjBrasilApi(
  valor: string,
  opcoes: { agora?: number } = {},
): Promise<ResultadoConsultaCnpj> {
  const validacao = validarCnpj(valor);
  if (!validacao.ok) return { error: validacao.erro };
  const cnpj = validacao.cnpj;

  const agora = opcoes.agora ?? Date.now();
  const emCache = cache.get(cnpj);
  if (emCache && emCache.expiraEm > agora) return { empresa: emCache.empresa };

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_BRASILAPI}/${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { error: MSG_ERRO };
  }

  if (resposta.status === 404) return { error: MSG_NAO_ENCONTRADO };
  if (resposta.status === 403 || resposta.status === 429) return { error: MSG_INDISPONIVEL };
  if (!resposta.ok) return { error: MSG_ERRO };

  try {
    const dados = (await resposta.json()) as RespostaBrasilApi;
    const empresa = mapearCnpj(dados, cnpj);
    cache.set(cnpj, { expiraEm: agora + CACHE_TTL_MS, empresa });
    return { empresa };
  } catch {
    return { error: MSG_ERRO };
  }
}
