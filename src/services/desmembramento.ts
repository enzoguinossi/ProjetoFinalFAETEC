import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/dao/_audit";
import { mensagemDeErro } from "@/dao/_errors";
import { saldoDAO } from "@/dao/estoque";
import { assertProdutoSemInventario } from "@/dao/inventario";
import { diaUtcSaoPaulo } from "@/lib/datas";

/** Entrada do desmembramento: um composto e a quantidade de unidades. */
export type DesmembrarInput = {
  id_produto: number;
  quantidade: number;
  id_usuario: number;
  /** Texto livre opcional, usado nas movimentações geradas. */
  observacao?: string | null;
};

/** Insumo ativo do composto, como a prévia e o serviço precisam validar. */
export type InsumoDoComposto = {
  id_produto: number;
  descricao: string;
  ativo: boolean;
  quantidade_por_unidade: number;
};

export type InsumoAgregado = {
  id_produto: number;
  descricao: string;
  quantidade_por_unidade: number;
};

type SaldoDoInsumo = InsumoAgregado & {
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
};

/**
 * Valida e agrega os insumos ativos do composto. A prévia e o serviço usam a
 * mesma regra, para a tela nunca aceitar um cenário que o servidor recusa.
 */
export function agregarInsumosDoComposto(
  insumos: InsumoDoComposto[],
): { error: string } | { insumos: InsumoAgregado[] } {
  const agregados = new Map<number, InsumoAgregado & { ativo: boolean }>();
  for (const insumo of insumos) {
    if (
      !Number.isFinite(insumo.quantidade_por_unidade) ||
      insumo.quantidade_por_unidade <= 0
    ) {
      return {
        error: `O insumo "${insumo.descricao}" tem quantidade inválida no cadastro do composto.`,
      };
    }

    const existente = agregados.get(insumo.id_produto);
    if (existente) {
      existente.quantidade_por_unidade += insumo.quantidade_por_unidade;
    } else {
      agregados.set(insumo.id_produto, {
        id_produto: insumo.id_produto,
        descricao: insumo.descricao,
        ativo: insumo.ativo,
        quantidade_por_unidade: insumo.quantidade_por_unidade,
      });
    }
  }

  const lista = [...agregados.values()];
  if (lista.length === 0) {
    return { error: "O produto não possui insumos ativos para desmembrar." };
  }

  const inativos = lista.filter((insumo) => !insumo.ativo);
  if (inativos.length > 0) {
    const nomes = inativos.map((insumo) => `"${insumo.descricao}"`).join(", ");
    return {
      error: `Reative o(s) insumo(s) ${nomes} ou ajuste o composto antes de desmembrar.`,
    };
  }

  return {
    insumos: lista.map((insumo) => ({
      id_produto: insumo.id_produto,
      descricao: insumo.descricao,
      quantidade_por_unidade: insumo.quantidade_por_unidade,
    })),
  };
}

export type ResultadoDesmembramento =
  | {
      id_nota_saida: number;
      id_nota_entrada: number;
      aviso: string | null;
      saldos: {
        produto: {
          id_produto: number;
          saldo_anterior: number;
          saldo_posterior: number;
          saldo_reservado: number;
        };
        insumos: {
          id_produto: number;
          saldo_anterior: number;
          saldo_posterior: number;
        }[];
      };
    }
  | { error: string };

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Desmembra um produto composto em uma única transação:
 *
 * - baixa `quantidade` do saldo do pai (`nota_saida` `DESMONTAGEM`,
 *   `BAIXA_TOTAL`, item com o total);
 * - soma `quantidade × quantidade_por_unidade` no saldo de cada insumo ativo
 *   (`nota_entrada` `DESMONTAGEM`, um item por insumo, agregando repetidos);
 * - grava as movimentações com as notas correspondentes;
 * - não mexe em `saldo_reservado`;
 * - respeita o bloqueio por inventário do pai e de todos os filhos;
 * - RN001: saldo insuficiente apenas retorna `aviso`, nunca bloqueia.
 *
 * Validar e gravar dentro da mesma transação evita que uma alteração
 * concorrente no produto/insumos produza notas divergentes do saldo.
 */
export class DesmembramentoService {
  async desmembrar(input: DesmembrarInput): Promise<ResultadoDesmembramento> {
    const idProduto = idPositivo(input.id_produto);
    if (!idProduto) return { error: "Produto inválido." };

    const quantidade = Number(input.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: "A quantidade a desmembrar deve ser maior que zero." };
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          // Primeira leitura: só a estrutura do composto (sem saldos). A
          // leitura dos saldos acontece depois do bloqueio das linhas.
          const produto = await tx.produto.findUnique({
            where: { id_produto: idProduto },
            select: {
              id_produto: true,
              descricao: true,
              composto: true,
              ativo: true,
              insumosPai: {
                where: { ativo: true },
                orderBy: { id_produto_insumo: "asc" },
                select: {
                  id_produto_filho: true,
                  quantidade: true,
                  produtoFilho: {
                    select: { id_produto: true, descricao: true, ativo: true },
                  },
                },
              },
            },
          });

          if (!produto) return { error: "Produto não encontrado." };
          if (!produto.composto) {
            return {
              error: "O produto não é composto e não pode ser desmembrado.",
            };
          }
          if (!produto.ativo) {
            return { error: "Produto inativo não pode ser desmembrado." };
          }

          // Agrega insumos repetidos: `item_nota_entrada` aceita um item por
          // produto (unique por nota/produto), e o total é o que entra no saldo.
          // A mesma função valida quantidade inválida e insumo inativo.
          const validado = agregarInsumosDoComposto(
            produto.insumosPai.map((insumo) => ({
              id_produto: insumo.produtoFilho.id_produto,
              descricao: insumo.produtoFilho.descricao,
              ativo: insumo.produtoFilho.ativo,
              quantidade_por_unidade: Number(insumo.quantidade),
            })),
          );
          if ("error" in validado) return validado;

          // Trava pai e filhos em ordem de `ID_produto` antes de checar o
          // inventário e de ler os saldos: duas chamadas concorrentes passam a
          // enxergar os saldos na ordem em que adquirem o bloqueio. Os ids são
          // números, sem interpolação de texto.
          const idsParaTravar = [
            ...new Set([
              idProduto,
              ...validado.insumos.map((insumo) => insumo.id_produto),
            ]),
          ].sort((a, b) => a - b);
          await tx.$queryRaw`
            SELECT ID_produto, saldo, saldo_reservado
            FROM produto
            WHERE ID_produto IN (${Prisma.join(idsParaTravar)})
            ORDER BY ID_produto
            FOR UPDATE
          `;

          // Bloqueio por inventário: pai e todos os filhos, antes de gravar.
          await assertProdutoSemInventario(idProduto, tx);
          for (const insumo of validado.insumos) {
            await assertProdutoSemInventario(insumo.id_produto, tx);
          }

          // Leitura dos saldos depois do bloqueio, na transação READ COMMITTED:
          // as linhas já travadas retornam o último valor confirmado (e não o
          // snapshot anterior à espera pelo lock).
          const saldosPai = await tx.produto.findUniqueOrThrow({
            where: { id_produto: idProduto },
            select: { saldo: true, saldo_reservado: true },
          });
          const saldoAnteriorPai = Number(saldosPai.saldo);
          const saldoReservado = Number(saldosPai.saldo_reservado);
          const disponivel = saldoAnteriorPai - saldoReservado;
          const aviso =
            quantidade > disponivel
              ? `Saldo insuficiente de ${produto.descricao} (disponível ${disponivel}, solicitado ${quantidade}). O desmembramento foi gravado mesmo assim (RN001).`
              : null;

          const insumos: SaldoDoInsumo[] = validado.insumos.map((insumo) => ({
            ...insumo,
            quantidade: 0,
            saldo_anterior: 0,
            saldo_posterior: 0,
          }));

          const agora = new Date();
          const textoDaNota = `Desmembramento de ${quantidade} unidade(s) de ${produto.descricao}`;
          const observacaoMovimento =
            input.observacao?.trim() || textoDaNota;

          const notaSaida = await tx.notaSaida.create({
            data: {
              id_destinatario: null,
              data_criacao: agora,
              tipo: "DESMONTAGEM",
              status: "BAIXA_TOTAL",
              urgente: false,
              observacao: textoDaNota,
            },
          });

          const itemSaida = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: notaSaida.id_nota_saida,
              id_produto: idProduto,
              qtd_esperada: quantidade,
              qtd_entregue: quantidade,
            },
          });

          const notaEntrada = await tx.notaEntrada.create({
            data: {
              id_fornecedor: null,
              data_criacao: agora,
              tipo: "DESMONTAGEM",
              // `data_recebimento` é DATE: usa o dia civil de São Paulo.
              data_recebimento: diaUtcSaoPaulo(agora),
              observacao: textoDaNota,
            },
          });

          const itensEntrada: {
            id_item_nota_entrada: number;
            id_produto: number;
            quantidade: number;
          }[] = [];
          const movimentacoesEntrada: {
            id_movimentacao: number;
            id_produto: number;
            quantidade: number;
            saldo_anterior: number;
            saldo_posterior: number;
          }[] = [];

          for (const insumo of insumos) {
            insumo.quantidade = quantidade * insumo.quantidade_por_unidade;

            const item = await tx.itemNotaEntrada.create({
              data: {
                id_nota_entrada: notaEntrada.id_nota_entrada,
                id_produto: insumo.id_produto,
                quantidade: insumo.quantidade,
              },
            });
            itensEntrada.push({
              id_item_nota_entrada: item.id_item_nota_entrada,
              id_produto: insumo.id_produto,
              quantidade: insumo.quantidade,
            });

            const entrada = await saldoDAO.registrarEntrada(
              {
                id_produto: insumo.id_produto,
                id_usuario: input.id_usuario,
                id_nota_entrada: notaEntrada.id_nota_entrada,
                quantidade: insumo.quantidade,
                data_entrada: agora,
                observacao: observacaoMovimento,
              },
              tx,
            );

            insumo.saldo_anterior = entrada.saldo_anterior;
            insumo.saldo_posterior = entrada.saldo_posterior;
            movimentacoesEntrada.push({
              id_movimentacao: entrada.movimentacao.id_movimentacao,
              id_produto: insumo.id_produto,
              quantidade: Number(entrada.movimentacao.quantidade),
              saldo_anterior: entrada.saldo_anterior,
              saldo_posterior: entrada.saldo_posterior,
            });
          }

          const baixa = await saldoDAO.baixarDireto(
            {
              id_produto: idProduto,
              id_nota_saida: notaSaida.id_nota_saida,
              id_usuario: input.id_usuario,
              quantidade,
              observacao: observacaoMovimento,
            },
            tx,
          );

          await registrarAuditoria(
            input.id_usuario,
            "CRIAR",
            "NotaSaida",
            notaSaida.id_nota_saida,
            null,
            {
              id_nota_saida: notaSaida.id_nota_saida,
              id_nota_entrada: notaEntrada.id_nota_entrada,
              tipo: "DESMONTAGEM",
              status: "BAIXA_TOTAL",
              id_destinatario: null,
              urgente: false,
              observacao: textoDaNota,
              itens: [
                {
                  id_item_nota_saida: itemSaida.id_item_nota_saida,
                  id_produto: idProduto,
                  quantidade_solicitada: quantidade,
                  quantidade_entregue: quantidade,
                },
              ],
              movimentacoes: [
                {
                  id_movimentacao: baixa.movimentacao.id_movimentacao,
                  id_produto: idProduto,
                  quantidade: Number(baixa.movimentacao.quantidade),
                  saldo_anterior: baixa.saldo_anterior,
                  saldo_posterior: baixa.saldo_posterior,
                },
              ],
            },
            tx,
          );

          await registrarAuditoria(
            input.id_usuario,
            "CRIAR",
            "NotaEntrada",
            notaEntrada.id_nota_entrada,
            null,
            {
              id_nota_entrada: notaEntrada.id_nota_entrada,
              id_nota_saida: notaSaida.id_nota_saida,
              tipo: "DESMONTAGEM",
              id_fornecedor: null,
              data_recebimento: diaUtcSaoPaulo(agora).toISOString(),
              observacao: textoDaNota,
              itens: itensEntrada,
              movimentacoes: movimentacoesEntrada,
            },
            tx,
          );

          return {
            id_nota_saida: notaSaida.id_nota_saida,
            id_nota_entrada: notaEntrada.id_nota_entrada,
            aviso,
            saldos: {
              produto: {
                id_produto: idProduto,
                saldo_anterior: baixa.saldo_anterior,
                saldo_posterior: baixa.saldo_posterior,
                saldo_reservado: saldoReservado,
              },
              insumos: insumos.map((insumo) => ({
                id_produto: insumo.id_produto,
                saldo_anterior: insumo.saldo_anterior,
                saldo_posterior: insumo.saldo_posterior,
              })),
            },
          };
        },
        // READ COMMITTED: os saldos lidos depois do `FOR UPDATE` vêm do último
        // commit, não do snapshot criado antes da espera pelo bloqueio.
        { isolationLevel: "ReadCommitted" },
      );
    } catch (e) {
      return {
        error: mensagemDeErro(
          e,
          "Erro ao desmembrar o produto. Tente novamente.",
        ),
      };
    }
  }
}

export const desmembramentoService = new DesmembramentoService();
