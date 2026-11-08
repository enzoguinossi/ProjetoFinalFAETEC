import type { ReferenciasAuditoria } from "@/lib/auditoria-diff";

/** Rótulos das entidades da trilha de auditoria. */
const ROTULOS_ENTIDADE: Record<string, string> = {
  produto: "Produto",
  funcionario: "Funcionário",
  usuario: "Usuário",
  destinatario: "Destinatário",
  fornecedor: "Fornecedor",
  veiculo: "Veículo",
  nota_saida: "Nota de saída",
  nota_entrada: "Nota de entrada",
  expedicao: "Expedição",
  pedido_escola: "Pedido",
  inventario: "Inventário",
  perfil: "Perfil",
  permissao: "Permissão",
  movimentacao: "Movimentação",
  item_nota_saida: "Item da nota de saída",
  item_nota_entrada: "Item da nota de entrada",
  ajuste_inventario: "Ajuste de inventário",
  reserva_estoque: "Reserva de estoque",
  coleta: "Coleta",
  percurso: "Percurso",
  mensagem_mural: "Mensagem do mural",
  tipo_codigo: "Tipo de código",
  tipo_destinatario: "Tipo de escola",
  conversao_unidade: "Unidade de conversão",
  endereco: "Endereço",
  backup: "Backup",
};

/** Rótulos das ações registradas. */
const ROTULOS_ACAO: Record<string, string> = {
  CRIAR: "Criar",
  ALTERAR: "Alterar",
  DESATIVAR: "Desativar",
  EXCLUIR: "Excluir",
  LOGIN: "Login",
  LOGIN_FALHA: "Falha de login",
  LOGOUT: "Logout",
  DEFINIR_SENHA: "Definir senha",
  SOLICITAR_BACKUP: "Solicitar backup",
  ALTERAR_AGENDA: "Alterar agenda",
  RESTAURAR: "Restaurar",
};

/** Ações de autenticação não representam alteração de dados. */
const ACOES_SEM_DIFF = new Set(["LOGIN", "LOGOUT", "LOGIN_FALHA"]);

/** `false` para ações de autenticação (o evento não deve mostrar diff). */
export function acaoTemDiff(acao: string): boolean {
  return !ACOES_SEM_DIFF.has(String(acao ?? "").toUpperCase());
}

/** `snake_case`/CamelCase → `snake_case` minúsculo. */
export function normalizarEntidade(entidade: string): string {
  return entidade
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Texto humanizado de reserva: `foo_bar` → `Foo bar`. */
function humanizar(valor: string): string {
  const texto = valor.replace(/_/g, " ").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : valor;
}

/** Rótulo da entidade (`nota_saida` → “Nota de saída”). */
export function rotuloEntidade(entidade: string): string {
  const normalizada = normalizarEntidade(entidade);
  return ROTULOS_ENTIDADE[normalizada] ?? humanizar(normalizada);
}

/** Rótulo da ação (`CRIAR` → “Criar”). */
export function rotuloAcao(acao: string): string {
  const chave = String(acao ?? "").toUpperCase();
  return ROTULOS_ACAO[chave] ?? humanizar(chave.toLowerCase());
}

type LinhaAuditoria = {
  entidade: string;
  id_entidade_afetada: number | null;
  dados_anteriores: unknown;
  dados_novos: unknown;
};

function textoDe(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (typeof valor === "number") return String(valor);
  return null;
}

/**
 * Descrição curta do evento: primeiro o que o próprio snapshot informa
 * (`descricao`, `razao_social`, `nome`, `placa`, `login`, `titulo`) e depois a
 * referência resolvida da entidade.
 */
export function descricaoEvento(
  linha: LinhaAuditoria,
  referencias: ReferenciasAuditoria,
): string | null {
  const chaves = ["descricao", "razao_social", "nome", "placa", "login", "titulo"];
  for (const dados of [linha.dados_novos, linha.dados_anteriores]) {
    if (typeof dados !== "object" || dados === null || Array.isArray(dados)) continue;
    const registro = dados as Record<string, unknown>;
    for (const chave of chaves) {
      const texto = textoDe(registro[chave]);
      if (texto) return texto;
    }
  }

  if (linha.id_entidade_afetada !== null) {
    return (
      referencias.get(
        `${normalizarEntidade(linha.entidade)}:${linha.id_entidade_afetada}`,
      ) ?? null
    );
  }
  return null;
}
