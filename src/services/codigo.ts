import { lerJson } from "@/lib/form-data";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import {
  tipoPermitido,
  validarCodigo,
  type CodigoInput,
  type EntidadeCodigo,
} from "@/lib/codigo";

type CodigoEntrada = { tipo: string; valor: string };

function ehCodigoEntrada(item: unknown): item is CodigoEntrada {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as { tipo?: unknown }).tipo === "string" &&
    typeof (item as { valor?: unknown }).valor === "string"
  );
}

/** Lê o campo `codigos` (JSON) do FormData; inválido → erro, ausente → lista vazia. */
function lerCodigos(formData: FormData): CodigoEntrada[] | { error: string } {
  const raw = lerJson(formData, "codigos");
  if (raw === null) return [];
  if (!Array.isArray(raw) || !raw.every(ehCodigoEntrada)) {
    return { error: "Dados de códigos inválidos." };
  }
  return raw;
}

export class CodigoService {
  /**
   * Lê o campo `codigos` (JSON: [{ tipo, valor }]) do FormData, valida o tipo
   * permitido para a entidade e o formato do valor, e resolve o id do tipo.
   */
  async resolverCodigosParaSalvar(
    entidade: EntidadeCodigo,
    formData: FormData,
  ): Promise<{ codigos: CodigoInput[] } | { error: string }> {
    const lidos = lerCodigos(formData);
    if (!Array.isArray(lidos)) return lidos;

    const entradas: { nome: string; valor: string }[] = [];
    for (const { tipo, valor } of lidos) {
      const bruto = valor;
      if (!bruto.trim()) continue;

      if (!tipoPermitido(entidade, tipo)) {
        return {
          error: `O tipo de código ${tipo} não é permitido para este cadastro.`,
        };
      }

      const validacao = validarCodigo(tipo, bruto);
      if (!validacao.ok) return { error: validacao.erro };

      entradas.push({ nome: tipo, valor: validacao.valor });
    }

    if (entradas.length === 0) return { codigos: [] };

    const tipos = await tipoCodigoDAO.getByNomes([...new Set(entradas.map((e) => e.nome))]);
    const idPorNome = new Map(tipos.map((t) => [t.nome, t.id_tipo_codigo]));

    const codigos: CodigoInput[] = [];
    for (const { nome, valor } of entradas) {
      const id_tipo_codigo = idPorNome.get(nome);
      if (!id_tipo_codigo) {
        return { error: `Tipo de código ${nome} não encontrado.` };
      }
      codigos.push({ id_tipo_codigo, codigo: valor });
    }

    return { codigos };
  }
}

export const codigoService = new CodigoService();
