import {
  percursoDAO,
  type PercursoDados,
  type PercursoDestinatarioDados,
} from "@/dao/percurso";

export type PercursoInput = {
  nome: string;
  descricao?: string | null;
  destinatarios: PercursoDestinatarioDados[];
};

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export class PercursoService {
  /**
   * Valida e normaliza o percurso:
   * - nome obrigatório;
   * - ao menos um destinatário, sem repetição;
   * - `ordem_visita` contínua, começando em 1 (1..N), devolvida ordenada.
   */
  validar(input: PercursoInput): { dados: PercursoDados } | { error: string } {
    const nome = input.nome?.trim();
    if (!nome) return { error: "Nome é obrigatório." };

    if (!Array.isArray(input.destinatarios) || input.destinatarios.length === 0) {
      return { error: "Selecione ao menos um destinatário." };
    }

    const ids = new Set<number>();
    for (const item of input.destinatarios) {
      const id = idPositivo(item.id_destinatario);
      if (!id) return { error: "Destinatário inválido no percurso." };
      if (ids.has(id)) {
        return { error: "O mesmo destinatário não pode aparecer mais de uma vez no percurso." };
      }
      if (!Number.isInteger(item.ordem_visita)) {
        return { error: "A ordem das visitas deve ser um número inteiro." };
      }
      ids.add(id);
    }

    const ordens = input.destinatarios
      .map((item) => item.ordem_visita)
      .sort((a, b) => a - b);
    const continua = ordens.every((ordem, indice) => ordem === indice + 1);
    if (!continua) {
      return { error: "A ordem das visitas deve ser contínua, começando em 1." };
    }

    const destinatarios = [...input.destinatarios]
      .sort((a, b) => a.ordem_visita - b.ordem_visita)
      .map((item, indice) => ({
        id_destinatario: item.id_destinatario,
        ordem_visita: indice + 1,
      }));

    return {
      dados: {
        nome,
        descricao: input.descricao?.trim() || null,
        destinatarios,
      },
    };
  }

  async criar(input: PercursoInput, id_usuario: number) {
    const validado = this.validar(input);
    if ("error" in validado) return validado;

    if (await percursoDAO.nomeAtivoEmUso(validado.dados.nome)) {
      return { error: "Já existe um percurso ativo com este nome." };
    }

    return { percurso: await percursoDAO.create(validado.dados, id_usuario) };
  }

  async alterar(id: number, input: PercursoInput, id_usuario: number) {
    const idPercurso = idPositivo(id);
    if (!idPercurso) return { error: "Percurso inválido." };

    const validado = this.validar(input);
    if ("error" in validado) return validado;

    if (await percursoDAO.nomeAtivoEmUso(validado.dados.nome, idPercurso)) {
      return { error: "Já existe um percurso ativo com este nome." };
    }

    const existente = await percursoDAO.getById(idPercurso);
    if (!existente) return { error: "Percurso não encontrado." };

    return {
      percurso: await percursoDAO.update(idPercurso, validado.dados, id_usuario),
    };
  }

  async desativar(id: number, id_usuario: number) {
    const idPercurso = idPositivo(id);
    if (!idPercurso) return { error: "Percurso inválido." };

    const existente = await percursoDAO.getById(idPercurso);
    if (!existente) return { error: "Percurso não encontrado." };

    return { percurso: await percursoDAO.desativar(idPercurso, id_usuario) };
  }
}

export const percursoService = new PercursoService();
