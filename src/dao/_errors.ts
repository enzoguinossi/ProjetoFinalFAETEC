import { Prisma } from "@prisma/client";

export class EntidadeComVinculosError extends Error {
  readonly entidade: string;
  readonly vinculos: string[];

  constructor(entidade: string, vinculos: string[]) {
    super(
      `Não é possível excluir ${entidade} pois possui vínculos: ${vinculos.join(", ")}.`,
    );
    this.name = "EntidadeComVinculosError";
    this.entidade = entidade;
    this.vinculos = vinculos;
  }
}

const MENSAGENS_UNICIDADE: { chave: string; mensagem: string }[] = [
  { chave: "numero", mensagem: "Já existe um telefone com este número." },
  { chave: "endereco", mensagem: "Já existe um e-mail com este endereço." },
  { chave: "cpf", mensagem: "Já existe um cadastro com este CPF." },
  { chave: "cnpj", mensagem: "Já existe um cadastro com este CNPJ." },
  { chave: "login", mensagem: "Este login já está em uso." },
  { chave: "placa", mensagem: "Já existe um veículo com esta placa." },
  { chave: "codigo", mensagem: "Já existe um cadastro com este código." },
  { chave: "chave_acesso", mensagem: "Já existe um registro com esta chave de acesso." },
  { chave: "nome", mensagem: "Já existe um registro com este nome." },
];

function normalizarTarget(target: unknown): string {
  if (Array.isArray(target)) return target.join(",").toLowerCase();
  if (typeof target === "string") return target.toLowerCase();
  return "";
}

function mensagemUnicidade(target: unknown): string {
  const alvo = normalizarTarget(target);
  for (const { chave, mensagem } of MENSAGENS_UNICIDADE) {
    if (alvo.includes(chave)) return mensagem;
  }
  return "Já existe um registro com este valor.";
}

function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return true;
  return (
    !!e &&
    typeof e === "object" &&
    (e as { name?: unknown }).name === "PrismaClientKnownRequestError" &&
    typeof (e as { code?: unknown }).code === "string"
  );
}

/**
 * Traduz erros do banco/domínio para uma mensagem exibível ao usuário.
 * O erro cru é registrado no console do servidor para diagnóstico.
 */
export function mensagemDeErro(e: unknown, fallback = "Erro ao salvar. Tente novamente."): string {
  if (e instanceof EntidadeComVinculosError) return e.message;

  if (isPrismaKnownError(e)) {
    console.error(`[prisma:${e.code}]`, e.message);
    switch (e.code) {
      case "P2002":
        return mensagemUnicidade(e.meta?.target);
      case "P2003":
        return "Não é possível concluir: existem registros vinculados.";
      case "P2025":
        return "Registro não encontrado.";
      case "P2000":
        return "Valor muito longo para este campo.";
      default:
        return fallback;
    }
  }

  console.error("[erro]", e);
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
