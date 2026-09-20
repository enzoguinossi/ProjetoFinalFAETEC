"use server";

import { produtoDAO } from "@/dao/produto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type ProdutoItem = { id_produto: number; descricao: string };

export async function searchProdutos(query: string) {
  if (query.length < 2) return [];
  return prisma.produto.findMany({
    where: {
      ativo: true,
      OR: [
        { descricao: { contains: query } },
        { produtoCodigos: { some: { codigo: { contains: query } } } },
      ],
    },
    select: { id_produto: true, descricao: true },
    take: 20,
    orderBy: { descricao: "asc" },
  });
}

export async function createProduto(formData: FormData) {
  const descricao = formData.get("descricao") as string;
  if (!descricao?.trim()) return { error: "Descrição é obrigatória" };

  const perecivel = formData.get("perecivel") === "on";
  const composto = formData.get("composto") === "on";
  const foto_url = (formData.get("foto_url") as string) || undefined;
  const id_conversao = formData.get("id_conversao")
    ? Number(formData.get("id_conversao"))
    : undefined;
  const data_validade = perecivel
    ? (formData.get("data_validade") as string) || undefined
    : undefined;

  // Códigos personalizados
  const codigos: { id_tipo_codigo: number; codigo: string }[] = [];
  const nomesTipos = formData.getAll("codigo_tipo") as string[];
  const valoresCodigos = formData.getAll("codigo_valor") as string[];
  for (let i = 0; i < nomesTipos.length; i++) {
    const nomeTipo = nomesTipos[i];
    const valor = valoresCodigos[i]?.trim();
    if (!valor) continue;
    const tipo = await prisma.tipoCodigo.findUnique({ where: { nome: nomeTipo } });
    if (tipo) codigos.push({ id_tipo_codigo: tipo.id_tipo_codigo, codigo: valor });
  }

  // Insumos (BOM)
  const insumos: { id_produto_filho: number; quantidade: number }[] = [];
  const idsFilho = formData.getAll("insumo_produto") as string[];
  const quantidades = formData.getAll("insumo_qtd") as string[];
  for (let i = 0; i < idsFilho.length; i++) {
    const id = Number(idsFilho[i]);
    const qtd = Number(quantidades[i]);
    if (!id || !qtd) continue;
    insumos.push({ id_produto_filho: id, quantidade: qtd });
  }

  // Usuário autenticado
  const user = await requireUser();
  const id_usuario = user.id_usuario;

  await produtoDAO.createCompleto(
    {
      descricao: descricao.trim(),
      foto_url,
      perecivel,
      composto,
      data_validade,
      id_conversao_padrao: id_conversao,
      codigos,
      insumos,
    },
    id_usuario,
  );

  return { success: true };
}