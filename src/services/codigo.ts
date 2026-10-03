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

    const codigos: CodigoInput[] = [];
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

      const tipo = await tipoCodigoDAO.getByNome(nome);
      if (!tipo) {
        return { error: `Tipo de código ${nome} não encontrado.` };
      }

      codigos.push({
        id_tipo_codigo: tipo.id_tipo_codigo,
        codigo: validacao.valor,
      });
    }

    return { codigos };
  }
}

export const codigoService = new CodigoService();
