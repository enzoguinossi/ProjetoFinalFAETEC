import { prisma } from "@/lib/prisma";
import { muralDAO } from "@/dao/mural";
import { formatarCodigo } from "@/lib/formatar";
import {
  diasAteValidade,
  fimDoDiaSaoPaulo,
} from "@/lib/datas";

export type FaixaValidade = 90 | 60 | 45 | 30;

/**
 * Faixa de alerta da RN002: 90, 60, 45 e 30 dias. Fora das faixas (mais de 90
 * dias ou já vencido) não existe mensagem ativa.
 */
export function faixaDeValidade(dias: number): FaixaValidade | null {
  if (dias > 90) return null;
  if (dias >= 61) return 90;
  if (dias >= 46) return 60;
  if (dias >= 31) return 45;
  if (dias >= 1) return 30;
  return null;
}

export function chaveValidade(idProduto: number, faixa: FaixaValidade): string {
  return `validade:${idProduto}:${faixa}`;
}

/** Extrai o produto de uma chave `validade:{id}:{faixa}`; `null` se inválida. */
export function produtoDaChave(chave: string | null): number | null {
  const achado = /^validade:(\d+):(?:30|45|60|90)$/.exec(chave ?? "");
  if (!achado) return null;
  const id = Number(achado[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** `data_validade` é uma coluna `DATE`: o dia civil está no ISO/UTC. */
function validadeISO(validade: Date): string {
  return validade.toISOString().slice(0, 10);
}

function formatarValidade(validade: Date): string {
  const iso = validadeISO(validade);
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function textoDias(dias: number): string {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence em 1 dia";
  return `vence em ${dias} dias`;
}

export function conteudoAlerta(
  produto: {
    id_produto: number;
    descricao: string;
    data_validade: Date;
  },
  agora: Date = new Date(),
): { conteudo: string; data_expiracao: Date } {
  const dias = diasAteValidade(produto.data_validade, agora);
  const validade = formatarValidade(produto.data_validade);
  const conteudo = `${produto.descricao} (${formatarCodigo(produto.id_produto)}) ${textoDias(
    dias,
  )} — validade ${validade}.`;
  const data_expiracao =
    fimDoDiaSaoPaulo(validadeISO(produto.data_validade)) ?? produto.data_validade;
  return { conteudo, data_expiracao };
}

type ProdutoAlerta = {
  id_produto: number;
  descricao: string;
  data_validade: Date;
};

/**
 * Mantém uma única mensagem automática ativa por produto perecível.
 *
 * - A faixa atual vira a chave `validade:{id}:{faixa}`; se ela já é a ativa,
 *   nada acontece (idempotente).
 * - Ao mudar de faixa, a anterior é desativada com a chave liberada e continua
 *   no histórico ("Ver anteriores").
 * - Produto vencido, inativo ou removido do alerta: a ativa é desativada.
 * - Falha em um produto não impede os demais nem o dashboard.
 */
export async function gerarAlertasValidade(agora: Date = new Date()): Promise<void> {
  const encontrados = await prisma.produto.findMany({
    where: { perecivel: true, ativo: true, data_validade: { not: null } },
    select: { id_produto: true, descricao: true, data_validade: true },
  });
  const produtos: ProdutoAlerta[] = encontrados.flatMap((produto) =>
    produto.data_validade
      ? [{ ...produto, data_validade: produto.data_validade }]
      : [],
  );

  const ativas = await muralDAO.listarAutomaticasAtivas();
  const elegiveis = new Set(produtos.map((produto) => produto.id_produto));
  const ativasPorProduto = new Map<number, typeof ativas>();

  for (const ativa of ativas) {
    const idProduto = produtoDaChave(ativa.chave);
    if (idProduto === null || !elegiveis.has(idProduto)) {
      await desativarSemBloquear(ativa.id_mensagem_mural);
      continue;
    }
    const lista = ativasPorProduto.get(idProduto) ?? [];
    lista.push(ativa);
    ativasPorProduto.set(idProduto, lista);
  }

  for (const produto of produtos) {
    try {
      await aplicarAlerta(produto, ativasPorProduto.get(produto.id_produto) ?? [], agora);
    } catch (erro) {
      // Um produto com problema não pode derrubar o dashboard nem os outros alertas.
      console.error(
        `[alerta-validade] produto ${produto.id_produto}:`,
        erro instanceof Error ? erro.message : erro,
      );
    }
  }
}

async function desativarSemBloquear(id: number) {
  try {
    await muralDAO.desativarAutomatica(id);
  } catch (erro) {
    console.error(
      `[alerta-validade] desativação da mensagem ${id}:`,
      erro instanceof Error ? erro.message : erro,
    );
  }
}

async function aplicarAlerta(
  produto: ProdutoAlerta,
  ativas: Awaited<ReturnType<typeof muralDAO.listarAutomaticasAtivas>>,
  agora: Date,
) {
  const dias = diasAteValidade(produto.data_validade, agora);
  const faixa = faixaDeValidade(dias);
  const alvo = faixa ? chaveValidade(produto.id_produto, faixa) : null;

  if (alvo && ativas.some((ativa) => ativa.chave === alvo)) {
    // A ativa já é desta faixa: idempotente.
    return;
  }

  const { conteudo, data_expiracao } = conteudoAlerta(produto, agora);

  await prisma.$transaction(async (tx) => {
    for (const ativa of ativas) {
      await muralDAO.desativarAutomatica(ativa.id_mensagem_mural, tx);
    }
    if (!alvo) return;

    await muralDAO.upsertAutomatica(
      alvo,
      {
        id_usuario: null,
        titulo: "Validade",
        conteudo,
        data_publicacao: agora,
        data_expiracao,
        automatica: true,
        ativo: true,
      },
      tx,
    );
  });
}

export const alertaValidadeService = { gerarAlertasValidade, faixaDeValidade };
