import { prisma } from "@/lib/prisma";
import {
  Prisma,
  type OrigemAjuste,
  type StatusAjuste,
  type StatusInventario,
} from "@prisma/client";
import { buildPagination, type ListParams } from "@/types";
import { limitesDoDiaUtc } from "@/lib/datas";
import { registrarAuditoria } from "./_audit";

/** Status em que o produto fica bloqueado para movimentações de saldo. */
export const STATUS_INVENTARIO_BLOQUEADO: StatusInventario[] = [
  "ABERTO",
  "EM_CONTAGEM",
  "AGUARDANDO_APROVACAO",
];

const EPS = 0.000001;
type Db = Prisma.TransactionClient;

export type InventarioListParams = ListParams & {
  status?: StatusInventario[];
  /** Início do período de `data_inicio` (`YYYY-MM-DD`, inclusivo). */
  de?: string;
  /** Fim do período de `data_inicio` (`YYYY-MM-DD`, inclusivo). */
  ate?: string;
  /** `true` = somente inventários de contagem cega. */
  contagemCega?: boolean;
};

export type CriarInventarioInput = {
  observacao: string;
  contagem_cega: boolean;
  todos?: boolean;
  id_produtos?: number[];
};

export type AtualizarInventarioInput = CriarInventarioInput;

export type ContarInventarioInput = {
  id_inventario: number;
  id_item_inventario: number;
  quantidade: number;
  observacao?: string | null;
  id_funcionario: number;
};

export type DecidirAjusteInput = {
  id_inventario: number;
  id_produto: number;
  origem: OrigemAjuste;
  id_contagem_inventario?: number | null;
  status: Extract<StatusAjuste, "APROVADO" | "REJEITADO">;
  justificativa?: string | null;
  id_usuario: number;
};

function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

function mediaContagens(quantidades: number[]): number {
  if (quantidades.length === 0) return 0;
  return arredondar(
    quantidades.reduce((soma, valor) => soma + Number(valor), 0) /
      quantidades.length,
  );
}

/**
 * Bloqueia qualquer movimentação de saldo de um produto enquanto ele pertence
 * a um inventário aberto/em contagem/aguardando aprovação.
 *
 * A movimentação de ajuste do próprio inventário NÃO passa por aqui; ela é
 * escrita diretamente na transação de `decidirAjuste`.
 */
export async function assertProdutoSemInventario(
  id_produto: number,
  client: Db = prisma,
) {
  const item = await client.itemInventario.findFirst({
    where: {
      id_produto,
      inventario: { status: { in: STATUS_INVENTARIO_BLOQUEADO } },
    },
    select: {
      id_inventario: true,
      inventario: { select: { observacao: true } },
    },
  });
  if (item) {
    const nome = item.inventario.observacao?.trim() || `#${item.id_inventario}`;
    throw new Error(
      `Produto bloqueado pelo inventário "${nome}" em andamento. Finalize ou cancele o inventário antes de movimentar o saldo.`,
    );
  }
}

export async function assertProdutosSemInventario(
  ids: number[],
  client: Db = prisma,
  ignorarInventarioId?: number,
) {  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  const item = await client.itemInventario.findFirst({
    where: {
      id_produto: { in: unicos },
      inventario: {
        status: { in: STATUS_INVENTARIO_BLOQUEADO },
        ...(ignorarInventarioId
          ? { id_inventario: { not: ignorarInventarioId } }
          : {}),
      },
    },
    select: {
      id_produto: true,
      id_inventario: true,
      produto: { select: { descricao: true } },
      inventario: { select: { observacao: true } },
    },
  });
  if (item) {
    const nome = item.inventario.observacao?.trim() || `#${item.id_inventario}`;
    throw new Error(
      `Produto "${item.produto.descricao}" bloqueado pelo inventário "${nome}" em andamento.`,
    );
  }
}

/** Trava a linha do inventário para serializar decisão/finalização/cancelamento. */
async function travarInventario(tx: Db, id: number) {
  await tx.$queryRaw`SELECT ID_inventario FROM inventario WHERE ID_inventario = ${id} FOR UPDATE`;
}

/** Trava a seleção (todos os ativos ou os IDs informados) antes da checagem. */
async function travarProdutosDaSelecao(tx: Db, input: CriarInventarioInput) {
  if (input.todos) {
    await tx.$queryRaw`SELECT ID_produto FROM produto WHERE ativo = 1 ORDER BY ID_produto FOR UPDATE`;
    return;
  }
  await travarProdutos(tx, input.id_produtos ?? []);
}

/** Trava as linhas de produto antes de checar sobreposição de inventário ativo. */
async function travarProdutos(tx: Db, ids: number[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  await tx.$queryRaw`SELECT ID_produto FROM produto WHERE ID_produto IN (${Prisma.join(unicos)}) ORDER BY ID_produto FOR UPDATE`;
}

export class InventarioDAO {
  async list(params: InventarioListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.InventarioWhereInput = {};
    if (params.search) where.observacao = { contains: params.search };
    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    }
    if (params.contagemCega === true) where.contagem_cega = true;
    const { inicio, fim } = limitesDoDiaUtc(params.de, params.ate);
    if (inicio || fim) {
      where.data_inicio = {
        ...(inicio ? { gte: inicio } : {}),
        ...(fim ? { lte: fim } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.inventario.findMany({
        skip,
        take,
        where,
        orderBy: { id_inventario: "desc" },
        include: {
          usuarioAbertura: {
            select: {
              funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
            },
          },
          itens: {
            select: {
              id_item_inventario: true,
              _count: { select: { contagens: true } },
            },
          },
        },
      }),
      prisma.inventario.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getById(id: number) {
    return prisma.inventario.findUnique({
      where: { id_inventario: id },
      include: {
        usuarioAbertura: {
          select: {
            id_usuario: true,
            funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
          },
        },
        usuarioAprovacao: {
          select: {
            id_usuario: true,
            funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
          },
        },
        itens: {
          orderBy: { id_item_inventario: "asc" },
          include: {
            produto: {
              select: {
                id_produto: true,
                descricao: true,
                ativo: true,
                saldo: true,
                saldo_reservado: true,
              },
            },
            contagens: {
              orderBy: { data_contagem: "asc" },
              include: {
                funcionario: {
                  select: {
                    id_funcionario: true,
                    pessoaFisica: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
        ajustes: {
          orderBy: { id_ajuste_inventario: "asc" },
          include: {
            produto: { select: { id_produto: true, descricao: true } },
            contagemInventario: { select: { id_contagem_inventario: true } },
            usuarioAprovacao: {
              select: {
                funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
              },
            },
            movimentacoes: {
              orderBy: { id_movimentacao: "asc" },
              select: {
                id_movimentacao: true,
                quantidade: true,
                saldo_anterior: true,
                saldo_posterior: true,
                data_hora: true,
              },
            },
          },
        },
      },
    });
  }

  private async produtosParaInventario(
    client: Db,
    input: CriarInventarioInput,
  ) {
    const ids = [...new Set(input.id_produtos ?? [])];
    if (!input.todos && ids.length === 0) {
      throw new Error("Selecione pelo menos um produto.");
    }

    const produtos = await client.produto.findMany({
      where: {
        ativo: true,
        ...(input.todos ? {} : { id_produto: { in: ids } }),
      },
      select: {
        id_produto: true,
        descricao: true,
        saldo: true,
      },
      orderBy: { descricao: "asc" },
    });

    if (produtos.length === 0) throw new Error("Nenhum produto ativo encontrado.");
    if (!input.todos && produtos.length !== ids.length) {
      throw new Error("Um ou mais produtos selecionados não estão ativos.");
    }
    return produtos;
  }

  async criar(input: CriarInventarioInput, id_usuario: number) {
    const observacao = input.observacao.trim();
    if (!observacao) throw new Error("Informe a observação (nome) do inventário.");

    return prisma.$transaction(async (tx) => {
      await travarProdutosDaSelecao(tx, input);
      const produtos = await this.produtosParaInventario(tx, input);
      await assertProdutosSemInventario(
        produtos.map((produto) => produto.id_produto),
        tx,
      );
      const inventario = await tx.inventario.create({
        data: {
          data_inicio: new Date(),
          contagem_cega: input.contagem_cega,
          status: "ABERTO",
          id_usuario_abertura: id_usuario,
          observacao,
        },
      });

      await tx.itemInventario.createMany({
        data: produtos.map((produto) => ({
          id_inventario: inventario.id_inventario,
          id_produto: produto.id_produto,
          quantidade_sistema: Number(produto.saldo),
        })),
      });

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        "Inventario",
        inventario.id_inventario,
        null,
        {
          id_inventario: inventario.id_inventario,
          observacao,
          contagem_cega: input.contagem_cega,
          status: "ABERTO",
          itens: produtos.map((produto) => ({
            id_produto: produto.id_produto,
            descricao: produto.descricao,
            quantidade_sistema: Number(produto.saldo),
          })),
        },
        tx,
      );

      return inventario;
    });
  }

  async atualizar(
    id: number,
    input: AtualizarInventarioInput,
    id_usuario: number,
  ) {
    const observacao = input.observacao.trim();
    if (!observacao) throw new Error("Informe a observação (nome) do inventário.");

    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, id);
      await travarProdutosDaSelecao(tx, input);
      const atual = await tx.inventario.findUnique({
        where: { id_inventario: id },
        include: {
          itens: {
            include: {
              produto: { select: { id_produto: true, descricao: true, saldo: true } },
            },
          },
        },
      });
      if (!atual) throw new Error("Inventário não encontrado.");
      if (atual.status !== "ABERTO") {
        throw new Error("Só é possível editar um inventário antes da primeira contagem.");
      }

      const idsItens = atual.itens.map((item) => item.id_item_inventario);
      const contagens = await tx.contagemInventario.count({
        where: { id_item_inventario: { in: idsItens } },
      });
      if (contagens > 0) {
        throw new Error("O inventário já possui contagens; edite apenas antes da primeira.");
      }

      const produtos = await this.produtosParaInventario(tx, input);
      await assertProdutosSemInventario(
        produtos.map((produto) => produto.id_produto),
        tx,
        id,
      );
      await tx.itemInventario.deleteMany({ where: { id_inventario: id } });
      await tx.itemInventario.createMany({
        data: produtos.map((produto) => ({
          id_inventario: id,
          id_produto: produto.id_produto,
          quantidade_sistema: Number(produto.saldo),
        })),
      });

      const inventario = await tx.inventario.update({
        where: { id_inventario: id },
        data: { observacao, contagem_cega: input.contagem_cega },
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Inventario",
        id,
        {
          id_inventario: id,
          observacao: atual.observacao,
          contagem_cega: atual.contagem_cega,
          status: atual.status,
          itens: atual.itens.map((item) => ({
            id_item_inventario: item.id_item_inventario,
            id_produto: item.id_produto,
            descricao: item.produto.descricao,
            quantidade_sistema: Number(item.quantidade_sistema),
            saldo_atual: Number(item.produto.saldo),
          })),
        },
        {
          id_inventario: id,
          observacao,
          contagem_cega: input.contagem_cega,
          status: inventario.status,
          itens: produtos.map((produto) => ({
            id_produto: produto.id_produto,
            descricao: produto.descricao,
            quantidade_sistema: Number(produto.saldo),
          })),
        },
        tx,
      );

      return inventario;
    });
  }

  async excluir(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.inventario.findUnique({
        where: { id_inventario: id },
        include: {
          itens: {
            include: {
              produto: { select: { id_produto: true, descricao: true, saldo: true } },
            },
          },
          ajustes: { select: { id_ajuste_inventario: true } },
        },
      });
      if (!atual) throw new Error("Inventário não encontrado.");

      const idsItens = atual.itens.map((item) => item.id_item_inventario);
      const contagens = await tx.contagemInventario.count({
        where: { id_item_inventario: { in: idsItens } },
      });
      if (contagens > 0 || atual.ajustes.length > 0) {
        throw new Error(
          "Este inventário já possui contagens/ajustes; não pode ser excluído. Cancele-o para preservar o histórico.",
        );
      }

      await tx.itemInventario.deleteMany({ where: { id_inventario: id } });
      await tx.inventario.delete({ where: { id_inventario: id } });
      await registrarAuditoria(
        id_usuario,
        "EXCLUIR",
        "Inventario",
        id,
        {
          id_inventario: id,
          observacao: atual.observacao,
          data_inicio: atual.data_inicio,
          status: atual.status,
          contagem_cega: atual.contagem_cega,
          itens: atual.itens.map((item) => ({
            id_item_inventario: item.id_item_inventario,
            id_produto: item.id_produto,
            descricao: item.produto.descricao,
            quantidade_sistema: Number(item.quantidade_sistema),
            saldo_atual: Number(item.produto.saldo),
          })),
        },
        null,
        tx,
      );
    });
  }

  async contar(input: ContarInventarioInput, id_usuario: number) {
    if (!Number.isFinite(input.quantidade) || input.quantidade < 0) {
      throw new Error("Informe uma contagem válida (zero ou positiva).");
    }

    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, input.id_inventario);
      const item = await tx.itemInventario.findUnique({
        where: { id_item_inventario: input.id_item_inventario },
        include: { inventario: true },
      });
      if (!item || item.id_inventario !== input.id_inventario) {
        throw new Error("Item do inventário não encontrado.");
      }
      if (item.inventario.status !== "ABERTO" && item.inventario.status !== "EM_CONTAGEM") {
        throw new Error("A contagem deste inventário não está aberta.");
      }

      const existente = await tx.contagemInventario.findFirst({
        where: {
          id_item_inventario: item.id_item_inventario,
          id_funcionario: input.id_funcionario,
        },
      });

      const contagem = existente
        ? await tx.contagemInventario.update({
            where: { id_contagem_inventario: existente.id_contagem_inventario },
            data: {
              quantidade_contada: input.quantidade,
              data_contagem: new Date(),
              observacao: input.observacao?.trim() || null,
            },
          })
        : await tx.contagemInventario.create({
            data: {
              id_item_inventario: item.id_item_inventario,
              id_funcionario: input.id_funcionario,
              quantidade_contada: input.quantidade,
              data_contagem: new Date(),
              observacao: input.observacao?.trim() || null,
            },
          });

      if (item.inventario.status === "ABERTO") {
        const transicao = await tx.inventario.updateMany({
          where: { id_inventario: input.id_inventario, status: "ABERTO" },
          data: { status: "EM_CONTAGEM" },
        });
        if (transicao.count === 1) {
          await registrarAuditoria(
            id_usuario,
            "ALTERAR",
            "Inventario",
            input.id_inventario,
            { id_inventario: input.id_inventario, status: "ABERTO" },
            { id_inventario: input.id_inventario, status: "EM_CONTAGEM" },
            tx,
          );
        }
      }

      await registrarAuditoria(
        id_usuario,
        existente ? "ALTERAR" : "CRIAR",
        "ContagemInventario",
        contagem.id_contagem_inventario,
        existente
          ? {
              id_contagem_inventario: existente.id_contagem_inventario,
              quantidade_contada: Number(existente.quantidade_contada),
              observacao: existente.observacao,
            }
          : null,
        {
          id_contagem_inventario: contagem.id_contagem_inventario,
          id_inventario: input.id_inventario,
          id_item_inventario: item.id_item_inventario,
          id_produto: item.id_produto,
          id_funcionario: input.id_funcionario,
          quantidade_contada: Number(contagem.quantidade_contada),
          observacao: contagem.observacao,
        },
        tx,
      );

      return contagem;
    });
  }

  async fecharContagem(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, id);
      const inventario = await tx.inventario.findUnique({
        where: { id_inventario: id },
        include: { itens: { select: { id_item_inventario: true } } },
      });
      if (!inventario) throw new Error("Inventário não encontrado.");
      if (inventario.status !== "ABERTO" && inventario.status !== "EM_CONTAGEM") {
        throw new Error("Este inventário não está em contagem.");
      }

      const idsItens = inventario.itens.map((item) => item.id_item_inventario);
      const contagens = await tx.contagemInventario.groupBy({
        by: ["id_item_inventario"],
        where: { id_item_inventario: { in: idsItens } },
      });
      const contados = new Set(contagens.map((c) => c.id_item_inventario));
      const faltando = idsItens.filter((idItem) => !contados.has(idItem));
      if (faltando.length > 0) {
        throw new Error(
          `Ainda há ${faltando.length} item(ns) sem contagem. Todos os produtos precisam ser contados.`,
        );
      }

      const atualizado = await tx.inventario.updateMany({
        where: {
          id_inventario: id,
          status: { in: ["ABERTO", "EM_CONTAGEM"] },
        },
        data: { status: "AGUARDANDO_APROVACAO" },
      });
      if (atualizado.count !== 1) {
        throw new Error("O status do inventário mudou; recarregue e tente novamente.");
      }
      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Inventario",
        id,
        { id_inventario: id, status: inventario.status },
        { id_inventario: id, status: "AGUARDANDO_APROVACAO", itens_contados: idsItens.length },
        tx,
      );
      return tx.inventario.findUniqueOrThrow({ where: { id_inventario: id } });
    });
  }

  async decidirAjuste(input: DecidirAjusteInput) {
    if (input.status !== "APROVADO" && input.status !== "REJEITADO") {
      throw new Error("A decisão deve ser APROVADO ou REJEITADO.");
    }
    if (input.origem !== "MEDIA" && input.origem !== "CONTAGEM") {
      throw new Error("A origem do ajuste deve ser MEDIA ou CONTAGEM.");
    }
    const justificativa = input.justificativa?.trim() || null;
    if (input.status === "REJEITADO" && !justificativa) {
      throw new Error("Informe a justificativa para rejeitar o ajuste.");
    }

    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, input.id_inventario);
      const inventario = await tx.inventario.findUnique({
        where: { id_inventario: input.id_inventario },
        include: {
          itens: {
            include: {
              contagens: {
                orderBy: { data_contagem: "asc" },
                select: {
                  id_contagem_inventario: true,
                  id_funcionario: true,
                  quantidade_contada: true,
                },
              },
            },
          },
          ajustes: { select: { id_produto: true } },
        },
      });
      if (!inventario) throw new Error("Inventário não encontrado.");
      if (inventario.status !== "AGUARDANDO_APROVACAO") {
        throw new Error("O inventário não está aguardando aprovação.");
      }

      const item = inventario.itens.find((i) => i.id_produto === input.id_produto);
      if (!item) throw new Error("Produto não pertence a este inventário.");
      if (item.quantidade_final !== null) {
        throw new Error("Este produto já teve a decisão registrada.");
      }
      if (item.contagens.length === 0) {
        throw new Error("O produto ainda não possui contagem.");
      }

      const media = mediaContagens(
        item.contagens.map((contagem) => Number(contagem.quantidade_contada)),
      );
      let quantidade_final = media;
      let id_contagem: number | null = null;

      if (input.origem === "CONTAGEM") {
        const contagem = item.contagens.find(
          (c) => c.id_contagem_inventario === input.id_contagem_inventario,
        );
        if (!contagem) {
          throw new Error("Selecione uma contagem individual válida.");
        }
        quantidade_final = Number(contagem.quantidade_contada);
        id_contagem = contagem.id_contagem_inventario;
      }

      const sistema = Number(item.quantidade_sistema);
      const delta = arredondar(quantidade_final - sistema);
      if (Math.abs(delta) < EPS && input.status === "REJEITADO") {
        throw new Error(
          "O valor escolhido é igual ao sistema; não há ajuste para rejeitar.",
        );
      }

      const agora = new Date();
      const decisao = await tx.itemInventario.updateMany({
        where: {
          id_item_inventario: item.id_item_inventario,
          quantidade_final: null,
        },
        data: {
          quantidade_final,
          origem: input.origem,
          id_contagem_inventario: id_contagem,
          decidido_em: agora,
          id_usuario_decisao: input.id_usuario,
        },
      });
      if (decisao.count !== 1) {
        throw new Error("Este produto já teve a decisão registrada.");
      }

      let ajuste: {
        id_ajuste_inventario: number;
      } | null = null;
      let movimentacao: {
        id_movimentacao: number;
        quantidade: number;
        saldo_anterior: number | null;
        saldo_posterior: number | null;
      } | null = null;

      if (Math.abs(delta) >= EPS) {
        ajuste = await tx.ajusteInventario.create({
          data: {
            id_inventario: input.id_inventario,
            id_produto: input.id_produto,
            quantidade_contada: quantidade_final,
            origem: input.origem,
            id_contagem_inventario: id_contagem,
            status: input.status,
            id_usuario_aprovacao: input.id_usuario,
            data_aprovacao: agora,
            justificativa,
          },
          select: { id_ajuste_inventario: true },
        });

        if (input.status === "APROVADO") {
          const produto = await tx.produto.findUniqueOrThrow({
            where: { id_produto: input.id_produto },
            select: { saldo: true },
          });
          const saldo_anterior = Number(produto.saldo);
          const saldo_posterior = arredondar(saldo_anterior + delta);
          await tx.produto.update({
            where: { id_produto: input.id_produto },
            data: { saldo: saldo_posterior },
          });
          movimentacao = await tx.movimentacaoEstoque.create({
            data: {
              id_produto: input.id_produto,
              id_usuario: input.id_usuario,
              id_ajuste_inventario: ajuste.id_ajuste_inventario,
              quantidade: delta,
              saldo_anterior,
              saldo_posterior,
              data_hora: agora,
              observacao: `Ajuste do inventário #${input.id_inventario}`,
            },
            select: {
              id_movimentacao: true,
              quantidade: true,
              saldo_anterior: true,
              saldo_posterior: true,
            },
          });

          await registrarAuditoria(
            input.id_usuario,
            "CRIAR",
            "MovimentacaoEstoque",
            movimentacao.id_movimentacao,
            null,
            {
              id_movimentacao: movimentacao.id_movimentacao,
              id_inventario: input.id_inventario,
              id_ajuste_inventario: ajuste.id_ajuste_inventario,
              id_produto: input.id_produto,
              quantidade: movimentacao.quantidade,
              saldo_anterior: movimentacao.saldo_anterior,
              saldo_posterior: movimentacao.saldo_posterior,
            },
            tx,
          );
        }

        await registrarAuditoria(
          input.id_usuario,
          "CRIAR",
          "AjusteInventario",
          ajuste.id_ajuste_inventario,
          null,
          {
            id_ajuste_inventario: ajuste.id_ajuste_inventario,
            id_inventario: input.id_inventario,
            id_produto: input.id_produto,
            quantidade_sistema: sistema,
            quantidade_contada: quantidade_final,
            delta,
            origem: input.origem,
            id_contagem_inventario: id_contagem,
            status: input.status,
            justificativa,
            movimentacao,
          },
          tx,
        );
      }

      await registrarAuditoria(
        input.id_usuario,
        "ALTERAR",
        "ItemInventario",
        item.id_item_inventario,
        { quantidade_final: null, decidido_em: null },
        {
          id_item_inventario: item.id_item_inventario,
          id_inventario: input.id_inventario,
          id_produto: input.id_produto,
          quantidade_sistema: sistema,
          quantidade_final,
          origem: input.origem,
          id_contagem_inventario: id_contagem,
          decidido_em: agora,
          id_usuario_decisao: input.id_usuario,
          ajuste: ajuste?.id_ajuste_inventario ?? null,
          movimentacao: movimentacao?.id_movimentacao ?? null,
        },
        tx,
      );

      await registrarAuditoria(
        input.id_usuario,
        "ALTERAR",
        "Inventario",
        input.id_inventario,
        { id_inventario: input.id_inventario, status: inventario.status },
        {
          id_inventario: input.id_inventario,
          status: inventario.status,
          decisao: {
            id_produto: input.id_produto,
            quantidade_final,
            origem: input.origem,
            status: input.status,
            justificativa,
          },
        },
        tx,
      );

      return { ajuste, movimentacao, quantidade_final, delta };
    });
  }

  async finalizar(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, id);
      const inventario = await tx.inventario.findUnique({
        where: { id_inventario: id },
        include: {
          itens: {
            include: {
              contagens: { select: { quantidade_contada: true } },
            },
          },
          ajustes: { select: { id_produto: true, status: true } },
        },
      });
      if (!inventario) throw new Error("Inventário não encontrado.");
      if (inventario.status !== "AGUARDANDO_APROVACAO") {
        throw new Error("O inventário não está aguardando aprovação.");
      }

      const semContagem = inventario.itens.filter(
        (item) => item.contagens.length === 0,
      );
      if (semContagem.length > 0) {
        throw new Error("Todos os itens precisam ter contagem antes da finalização.");
      }

      const naoDecididos = inventario.itens.filter(
        (item) => item.quantidade_final === null,
      );
      if (naoDecididos.length > 0) {
        throw new Error(
          `Ainda há ${naoDecididos.length} item(ns) sem decisão de aprovação/rejeição.`,
        );
      }

      const produtosComAjuste = new Set(
        inventario.ajustes.map((ajuste) => ajuste.id_produto),
      );
      const diferencasSemAjuste = inventario.itens.filter((item) => {
        const deltaDiferenca = arredondar(
          Number(item.quantidade_final) - Number(item.quantidade_sistema),
        );
        return Math.abs(deltaDiferenca) >= EPS && !produtosComAjuste.has(item.id_produto);
      });
      if (diferencasSemAjuste.length > 0) {
        throw new Error(
          `Ainda há ${diferencasSemAjuste.length} diferença(s) sem ajuste registrado.`,
        );
      }

      const agora = new Date();
      const transicao = await tx.inventario.updateMany({
        where: { id_inventario: id, status: "AGUARDANDO_APROVACAO" },
        data: {
          status: "FINALIZADO",
          data_fim: agora,
          id_usuario_aprovacao: id_usuario,
        },
      });
      if (transicao.count !== 1) {
        throw new Error("O inventário já foi finalizado ou teve o status alterado.");
      }

      const atualizado = await tx.inventario.findUniqueOrThrow({
        where: { id_inventario: id },
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Inventario",
        id,
        { id_inventario: id, status: inventario.status },
        {
          id_inventario: id,
          status: atualizado.status,
          data_fim: agora,
          id_usuario_aprovacao: id_usuario,
          itens: inventario.itens.map((item) => ({
            id_produto: item.id_produto,
            quantidade_sistema: Number(item.quantidade_sistema),
            quantidade_final:
              item.quantidade_final === null ? null : Number(item.quantidade_final),
            origem: item.origem,
            decidido_em: item.decidido_em,
          })),
          ajustes: inventario.ajustes.map((ajuste) => ({
            id_produto: ajuste.id_produto,
            status: ajuste.status,
          })),
        },
        tx,
      );
      return atualizado;
    });
  }

  async cancelar(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      await travarInventario(tx, id);
      const inventario = await tx.inventario.findUnique({
        where: { id_inventario: id },
        include: {
          itens: {
            select: {
              id_item_inventario: true,
              id_produto: true,
              quantidade_sistema: true,
              quantidade_final: true,
            },
          },
          ajustes: {
            select: {
              id_ajuste_inventario: true,
              status: true,
              movimentacoes: { select: { id_movimentacao: true } },
            },
          },
        },
      });
      if (!inventario) throw new Error("Inventário não encontrado.");
      if (!["ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO"].includes(inventario.status)) {
        throw new Error("Este inventário não pode mais ser cancelado.");
      }
      if (
        inventario.ajustes.some(
          (ajuste) => ajuste.status === "APROVADO" || ajuste.movimentacoes.length > 0,
        )
      ) {
        throw new Error(
          "Este inventário já possui ajuste aprovado/movimentação; não pode ser cancelado.",
        );
      }

      const agora = new Date();
      const transicao = await tx.inventario.updateMany({
        where: {
          id_inventario: id,
          status: { in: ["ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO"] },
        },
        data: { status: "CANCELADO", data_fim: agora },
      });
      if (transicao.count !== 1) {
        throw new Error("O status do inventário mudou; recarregue e tente novamente.");
      }

      const atualizado = await tx.inventario.findUniqueOrThrow({
        where: { id_inventario: id },
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Inventario",
        id,
        {
          id_inventario: id,
          status: inventario.status,
          data_fim: inventario.data_fim,
          itens: inventario.itens.map((item) => ({
            id_produto: item.id_produto,
            quantidade_sistema: Number(item.quantidade_sistema),
            quantidade_final:
              item.quantidade_final === null ? null : Number(item.quantidade_final),
          })),
          ajustes: inventario.ajustes.length,
        },
        {
          id_inventario: id,
          status: atualizado.status,
          data_fim: agora,
          ajustes: inventario.ajustes.length,
        },
        tx,
      );
      return atualizado;
    });
  }
}

export const inventarioDAO = new InventarioDAO();
