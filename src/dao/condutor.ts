import { prisma } from "@/lib/prisma";

export class CondutorDAO {
  async criarOuAtivar(id_funcionario: number) {
    const existente = await prisma.condutor.findUnique({ where: { id_funcionario } });
    if (existente) {
      if (!existente.ativo) {
        return prisma.condutor.update({ where: { id_funcionario }, data: { ativo: true } });
      }
      return existente;
    }
    return prisma.condutor.create({ data: { id_funcionario } });
  }

  async desativar(id_funcionario: number) {
    return prisma.condutor.updateMany({
      where: { id_funcionario, ativo: true },
      data: { ativo: false },
    });
  }
}

export const condutorDAO = new CondutorDAO();