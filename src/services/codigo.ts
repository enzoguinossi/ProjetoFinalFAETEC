import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import {
  tipoPermitido,
  validarCodigo,
  type CodigoInput,
  type EntidadeCodigo,
} from "@/lib/codigo";

export class CodigoService {
  /**
   * Lê os campos codigo_tipo[] / codigo_valor[] de um FormData, valida o tipo
   * permitido para a entidade e o formato do valor, e resolve o id do tipo.
   */
  async resolverCodigosParaSalvar(
    entidade: EntidadeCodigo,
    formData: FormData,
  ): Promise<{ codigos: CodigoInput[] } | { error: string }> {
    const nomesTipos = formData.getAll("codigo_tipo") as string[];
    const valores = formData.getAll("codigo_valor") as string[];

    const entradas: { nome: string; valor: string }[] = [];
    for (let i = 0; i < nomesTipos.length; i++) {
      const nome = nomesTipos[i];
      const bruto = valores[i] ?? "";
      if (!bruto.trim()) continue;

      if (!tipoPermitido(entidade, nome)) {
        return {
          error: `O tipo de código ${nome} não é permitido para este cadastro.`,
        };
      }

      const validacao = validarCodigo(nome, bruto);
      if (!validacao.ok) return { error: validacao.erro };

      entradas.push({ nome, valor: validacao.valor });
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
