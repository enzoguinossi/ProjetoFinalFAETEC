import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { formatarCodigo, hojeISO } from "../src/lib/formatar";
import { notaEntradaService } from "../src/services/nota-entrada";
import { pedidoService } from "../src/services/pedido";
import { expedicaoService } from "../src/services/expedicao";

/**
 * Seed de movimentações, exclusivo do banco de desenvolvimento `nexus`.
 *
 * Para cada produto ativo, gera 3 entradas (notas de entrada com 100/80/60) e
 * 3 saídas pelo fluxo completo (pedido → remessa → expedição → entrega →
 * baixa). Aditivo e idempotente: usa a observação `[seed-mov]` como marcador e
 * retoma cada etapa sem duplicar.
 *
 * Uso: npm run db:seed:mov
 */

const BANCO_ALVO = "nexus";
const PREFIXO = "[seed-mov]";
const STATUS_INVENTARIO_ATIVO = ["ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO"] as const;
const STATUS_NOTA_BAIXADA = ["BAIXA_TOTAL", "BAIXA_PARCIAL", "BAIXA_COM_CORTE"] as const;

const QUANTIDADES_ENTRADA = [100, 80, 60];
const RODADAS_SAIDA = [1, 2, 3];
const QUANTIDADE_POR_PRODUTO = 40;

function bancoDe(url: string): { host: string; banco: string } {
  const parsed = new URL(url);
  return {
    host: `${parsed.hostname}:${parsed.port || "3306"}`,
    banco: parsed.pathname.replace(/^\//, ""),
  };
}

function falhar(mensagem: string): never {
  throw new Error(mensagem);
}

/** Extrai o valor de um retorno `{ error }` dos services, com contexto. */
function garantir<T extends object>(
  resultado: T | { error: string },
  contexto: string,
): T {
  if ("error" in resultado) {
    falhar(`${contexto}: ${resultado.error}`);
  }
  return resultado as T;
}

function chunk<T>(lista: T[], tamanho: number): T[][] {
  const grupos: T[][] = [];
  for (let inicio = 0; inicio < lista.length; inicio += tamanho) {
    grupos.push(lista.slice(inicio, inicio + tamanho));
  }
  return grupos;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    falhar("DATABASE_URL não definida. Configure o .env da raiz.");
  }

  const { host, banco } = bancoDe(url);
  console.log(`Banco alvo: ${host}/${banco}`);

  if (process.env.NODE_ENV === "production") {
    falhar("Seed de movimentações bloqueado: NODE_ENV=production.");
  }
  if (banco === "nexus_prod") {
    falhar("Seed de movimentações bloqueado: banco de produção (nexus_prod).");
  }
  if (banco !== BANCO_ALVO) {
    falhar(
      `Seed de movimentações só roda no banco de desenvolvimento "${BANCO_ALVO}" (atual: "${banco}").`,
    );
  }

  /* ── Pré-requisitos: falham antes de qualquer gravação ── */
  const [usuario, produtos, fornecedor, destinatarios, veiculo, condutor] =
    await Promise.all([
      prisma.usuario.findFirst({
        where: { ativo: true },
        orderBy: { id_usuario: "asc" },
        select: { id_usuario: true },
      }),
      prisma.produto.findMany({
        where: { ativo: true },
        orderBy: { id_produto: "asc" },
        select: { id_produto: true, descricao: true },
      }),
      prisma.fornecedor.findFirst({
        where: { ativo: true },
        orderBy: { id_fornecedor: "asc" },
        select: { id_fornecedor: true },
      }),
      prisma.destinatario.findMany({
        where: { ativo: true },
        orderBy: { id_destinatario: "asc" },
        select: { id_destinatario: true },
      }),
      prisma.veiculo.findFirst({
        where: { ativo: true },
        orderBy: { id_veiculo: "asc" },
        select: { id_veiculo: true },
      }),
      prisma.funcionario.findFirst({
        where: { ativo: true, condutor: true },
        orderBy: { id_funcionario: "asc" },
        select: { id_funcionario: true },
      }),
    ]);

  if (!usuario) {
    falhar(
      "Nenhum usuário ativo. Rode `npm run db:seed` e conclua o primeiro acesso, ou use `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }
  if (produtos.length === 0) {
    falhar(
      "Nenhum produto ativo. Cadastre produtos ou rode `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }
  if (!fornecedor) {
    falhar(
      "Nenhum fornecedor ativo. Cadastre um fornecedor ou rode `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }
  if (destinatarios.length === 0) {
    falhar(
      "Nenhum destinatário ativo. Cadastre um destinatário ou rode `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }
  if (!veiculo) {
    falhar(
      "Nenhum veículo ativo. Cadastre um veículo ou rode `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }
  if (!condutor) {
    falhar(
      "Nenhum funcionário ativo com `condutor = true`. Cadastre um condutor ou rode `npm run db:seed:demo` no banco de desenvolvimento.",
    );
  }

  const produtosEmInventario = await prisma.produto.findMany({
    where: {
      ativo: true,
      itensInventario: {
        some: {
          inventario: { status: { in: [...STATUS_INVENTARIO_ATIVO] } },
        },
      },
    },
    select: { descricao: true },
  });
  if (produtosEmInventario.length > 0) {
    falhar(
      `Produtos em inventário ativo (bloqueado): ${produtosEmInventario
        .map((produto) => produto.descricao)
        .join(", ")}. Finalize/cancele o inventário e rode o seed novamente.`,
    );
  }

  const idUsuario = usuario.id_usuario;

  /* ── Entradas: 3 notas com todos os produtos ── */
  for (const [indice, quantidade] of QUANTIDADES_ENTRADA.entries()) {
    const numero = indice + 1;
    const observacao = `${PREFIXO} entrada ${numero}/${QUANTIDADES_ENTRADA.length}`;

    const existente = await prisma.notaEntrada.findFirst({
      where: { observacao },
      select: { id_nota_entrada: true },
    });
    if (existente) {
      console.log(`Entrada ${numero}: já existe (nota ${existente.id_nota_entrada}), pulando.`);
      continue;
    }

    const resultado = await notaEntradaService.registrar(
      {
        id_fornecedor: fornecedor.id_fornecedor,
        data_recebimento: hojeISO(),
        observacao,
        itens: produtos.map((produto) => ({
          id_produto: produto.id_produto,
          quantidade,
        })),
      },
      idUsuario,
    );
    const criada = garantir(resultado, `criar ${observacao}`);
    console.log(
      `Entrada ${numero}: nota ${criada.nota.id_nota_entrada} com ${produtos.length} produto(s) × ${quantidade}.`,
    );
  }

  /* ── Saídas: 3 rodadas, até 3 grupos por rodada ── */
  const tamanhoGrupo = Math.ceil(produtos.length / 3);

  for (const rodada of RODADAS_SAIDA) {
    const grupos = chunk(produtos, tamanhoGrupo);

    for (const [indiceGrupo, itensProdutos] of grupos.entries()) {
      const grupo = indiceGrupo + 1;
      const marcador = `r${rodada} g${grupo}`;
      const observacaoPedido = `${PREFIXO} pedido ${marcador}`;
      const observacaoExpedicao = `${PREFIXO} expedicao ${marcador}`;
      const destinatario =
        destinatarios[(rodada - 1) * 3 + indiceGrupo] ?? destinatarios[0];

      let pedido = await prisma.pedidoEscola.findFirst({
        where: { observacao: observacaoPedido },
        orderBy: { id_pedido_escola: "asc" },
        select: {
          id_pedido_escola: true,
          status: true,
          id_nota_saida: true,
        },
      });

      if (!pedido) {
        const criado = garantir(
          await pedidoService.criar(
            {
              id_destinatario: destinatario.id_destinatario,
              observacao: observacaoPedido,
              itens: itensProdutos.map((produto) => ({
                id_produto: produto.id_produto,
                quantidade: QUANTIDADE_POR_PRODUTO,
              })),
            },
            idUsuario,
          ),
          `criar ${observacaoPedido}`,
        );
        pedido = await prisma.pedidoEscola.findUniqueOrThrow({
          where: { id_pedido_escola: criado.pedido.id_pedido_escola },
          select: {
            id_pedido_escola: true,
            status: true,
            id_nota_saida: true,
          },
        });
        console.log(`Pedido ${marcador}: criado (${pedido.id_pedido_escola}).`);
      } else {
        console.log(`Pedido ${marcador}: já existe (${pedido.id_pedido_escola}).`);
      }

      if (pedido.status === "RECUSADO") {
        falhar(`${observacaoPedido}: pedido recusado; não é possível continuar.`);
      }

      if (pedido.status === "PENDENTE") {
        garantir(
          await pedidoService.aprovar(pedido.id_pedido_escola, idUsuario),
          `aprovar ${observacaoPedido}`,
        );
        console.log(`Pedido ${marcador}: aprovado.`);
      }

      let idNotaSaida = pedido.id_nota_saida;
      if (idNotaSaida === null) {
        const importado = garantir(
          await pedidoService.importar(pedido.id_pedido_escola, idUsuario),
          `importar ${observacaoPedido}`,
        );
        idNotaSaida = importado.nota.id_nota_saida;
        console.log(`Pedido ${marcador}: importado na remessa ${idNotaSaida}.`);
      } else {
        console.log(`Pedido ${marcador}: já tem remessa ${idNotaSaida}.`);
      }

      const nota = await prisma.notaSaida.findUniqueOrThrow({
        where: { id_nota_saida: idNotaSaida },
        select: { status: true },
      });
      if ((STATUS_NOTA_BAIXADA as readonly string[]).includes(nota.status)) {
        console.log(`Remessa ${idNotaSaida}: já baixada (${nota.status}), pulando expedição.`);
        continue;
      }

      let expedicao = await prisma.expedicao.findFirst({
        where: { observacao: observacaoExpedicao },
        orderBy: { id_expedicao: "asc" },
        select: { id_expedicao: true, status: true },
      });

      if (!expedicao) {
        const criada = garantir(
          await expedicaoService.criar(
            {
              data_prevista: hojeISO(),
              id_veiculo: veiculo.id_veiculo,
              id_funcionario_condutor: condutor.id_funcionario,
              id_percurso: null,
              observacao: observacaoExpedicao,
            },
            idUsuario,
          ),
          `criar ${observacaoExpedicao}`,
        );
        expedicao = {
          id_expedicao: criada.expedicao.id_expedicao,
          status: criada.expedicao.status,
        };
        console.log(
          `Expedição ${marcador}: criada (${expedicao.id_expedicao}).`,
        );
      } else {
        console.log(`Expedição ${marcador}: já existe (${expedicao.id_expedicao}).`);
      }

      if (expedicao.status === "CONCLUIDA") {
        console.log(`Expedição ${marcador}: já concluída, pulando.`);
        continue;
      }

      const vinculo = await prisma.expedicaoNota.findFirst({
        where: {
          id_expedicao: expedicao.id_expedicao,
          id_nota_saida: idNotaSaida,
        },
        select: { id_expedicao_nota: true },
      });
      let temVinculo = Boolean(vinculo);

      if (expedicao.status === "PLANEJADA") {
        if (!temVinculo) {
          garantir(
            await expedicaoService.adicionarNota(
              expedicao.id_expedicao,
              idNotaSaida,
              idUsuario,
            ),
            `adicionar nota ${idNotaSaida} em ${observacaoExpedicao}`,
          );
          temVinculo = true;
          console.log(`Expedição ${marcador}: nota ${idNotaSaida} adicionada.`);
        }
        garantir(
          await expedicaoService.despachar(expedicao.id_expedicao, idUsuario),
          `despachar ${observacaoExpedicao}`,
        );
        expedicao = { ...expedicao, status: "EM_PERCURSO" };
        console.log(`Expedição ${marcador}: despachada.`);
      }

      if (expedicao.status === "EM_PERCURSO") {
        if (!temVinculo) {
          garantir(
            await expedicaoService.adicionarNota(
              expedicao.id_expedicao,
              idNotaSaida,
              idUsuario,
            ),
            `garantir nota ${idNotaSaida} em ${observacaoExpedicao}`,
          );
          temVinculo = true;
        }

        const notaAtual = await prisma.notaSaida.findUniqueOrThrow({
          where: { id_nota_saida: idNotaSaida },
          select: { status: true },
        });
        if (!(STATUS_NOTA_BAIXADA as readonly string[]).includes(notaAtual.status)) {
          const itens = await prisma.itemNotaSaida.findMany({
            where: { id_nota_saida: idNotaSaida },
            select: { id_item_nota_saida: true, qtd_esperada: true },
          });
          garantir(
            await expedicaoService.registrarEntrega(
              expedicao.id_expedicao,
              idNotaSaida,
              {
                itens: itens.map((item) => ({
                  id_item_nota_saida: item.id_item_nota_saida,
                  qtd_entregue: Number(item.qtd_esperada),
                })),
                cortar_restante: false,
              },
              idUsuario,
            ),
            `entregar ${idNotaSaida} em ${observacaoExpedicao}`,
          );
          console.log(`Remessa ${idNotaSaida}: entregue 100%.`);
        }
        garantir(
          await expedicaoService.concluir(expedicao.id_expedicao, idUsuario),
          `concluir ${observacaoExpedicao}`,
        );
        console.log(`Expedição ${marcador}: concluída.`);
      }
    }
  }

  /* ── Resumo e conferência ── */
  const observacoesEntrada = QUANTIDADES_ENTRADA.map(
    (_, indice) => `${PREFIXO} entrada ${indice + 1}/${QUANTIDADES_ENTRADA.length}`,
  );
  const notasEntrada = await prisma.notaEntrada.findMany({
    where: { observacao: { in: observacoesEntrada } },
    select: { id_nota_entrada: true },
  });
  const notasSaida = await prisma.notaSaida.findMany({
    where: { observacao: { startsWith: `${PREFIXO} pedido ` } },
    select: { id_nota_saida: true },
  });

  const idEntradas = notasEntrada.map((nota) => nota.id_nota_entrada);
  const idSaidas = notasSaida.map((nota) => nota.id_nota_saida);

  const [movEntradas, movSaidas, pedidos, expedicoes] = await Promise.all([
    prisma.movimentacaoEstoque.findMany({
      where: { id_nota_entrada: { in: idEntradas } },
      select: { id_produto: true },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { id_nota_saida: { in: idSaidas } },
      select: { id_produto: true },
    }),
    prisma.pedidoEscola.count({
      where: { observacao: { startsWith: `${PREFIXO} pedido ` } },
    }),
    prisma.expedicao.count({
      where: { observacao: { startsWith: `${PREFIXO} expedicao ` } },
    }),
  ]);

  const contarPorProduto = (movimentos: { id_produto: number }[]) => {
    const mapa = new Map<number, number>();
    for (const movimento of movimentos) {
      mapa.set(movimento.id_produto, (mapa.get(movimento.id_produto) ?? 0) + 1);
    }
    return mapa;
  };
  const porProdutoEntrada = contarPorProduto(movEntradas);
  const porProdutoSaida = contarPorProduto(movSaidas);

  console.log("\nResumo do seed de movimentações:");
  console.log(`- Produtos ativos: ${produtos.length}`);
  console.log(`- Notas de entrada do seed: ${notasEntrada.length}`);
  console.log(`- Pedidos do seed: ${pedidos}`);
  console.log(`- Remessas do seed: ${notasSaida.length}`);
  console.log(`- Expedições do seed: ${expedicoes}`);
  console.log("- Por produto (entradas / saídas):");

  const divergentes: string[] = [];
  for (const produto of produtos) {
    const entradas = porProdutoEntrada.get(produto.id_produto) ?? 0;
    const saidas = porProdutoSaida.get(produto.id_produto) ?? 0;
    console.log(
      `  ${formatarCodigo(produto.id_produto)} ${produto.descricao}: ${entradas} / ${saidas}`,
    );
    if (entradas !== QUANTIDADES_ENTRADA.length || saidas !== RODADAS_SAIDA.length) {
      divergentes.push(
        `${produto.descricao}: ${entradas} entrada(s), ${saidas} saída(s)`,
      );
    }
  }

  if (divergentes.length > 0) {
    console.warn(
      `\nAtenção: produtos divergentes (esperado ${QUANTIDADES_ENTRADA.length} e ${RODADAS_SAIDA.length}):\n- ${divergentes.join(
        "\n- ",
      )}`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `\nOK: todos os produtos têm ${QUANTIDADES_ENTRADA.length} entradas e ${RODADAS_SAIDA.length} saídas do seed.`,
    );
  }
}

main()
  .catch((erro) => {
    console.error(
      "Falha no seed de movimentações:",
      erro instanceof Error ? erro.message : erro,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
