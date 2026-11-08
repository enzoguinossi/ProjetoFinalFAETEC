import { formatarCodigo } from "@/lib/formatar";
import type { CelulaPlanilha, TabelaPlanilha } from "@/lib/planilha";
import type { InventarioDAO } from "@/dao/inventario";

export type InventarioCompleto = NonNullable<
  Awaited<ReturnType<InventarioDAO["getById"]>>
>;

export const EPS_INVENTARIO = 0.000001;

export function mediaContagens(quantidades: number[]): number {
  if (quantidades.length === 0) return 0;
  return arredondar(
    quantidades.reduce((soma, valor) => soma + Number(valor), 0) /
      quantidades.length,
  );
}

export function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export function temDiferenca(
  quantidadeSistema: number,
  quantidadeContada: number,
): boolean {
  return Math.abs(arredondar(quantidadeContada - quantidadeSistema)) >= EPS_INVENTARIO;
}

export const ROTULOS_STATUS_INVENTARIO: Record<string, string> = {
  ABERTO: "Aberto",
  EM_CONTAGEM: "Em contagem",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export const ROTULOS_ORIGEM_AJUSTE: Record<string, string> = {
  MEDIA: "Média",
  CONTAGEM: "Contagem individual",
};

export const ROTULOS_STATUS_AJUSTE: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

function valorCsv(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function quantidadeCsv(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return arredondar(Number(valor)).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

/**
 * Tabela do inventário fechado/cancelado: mesma coluna do CSV, com as
 * quantidades e saldos como números nativos (e omitidos sem `incluirSistema`).
 */
export function tabelaInventario(
  inventario: InventarioCompleto,
  opcoes: { incluirSistema?: boolean } = {},
): TabelaPlanilha {
  const incluirSistema = opcoes.incluirSistema ?? true;
  const cabecalho = [
    "Inventário",
    "Observação",
    "Status",
    "Data de início",
    "Data de fim",
    "Código",
    "Produto",
    ...(incluirSistema ? ["Quantidade do sistema"] : []),
    "Contagens",
    "Média",
    "Origem do ajuste",
    ...(incluirSistema ? ["Quantidade contada", "Status do ajuste"] : []),
    "Justificativa",
    "Aprovador",
    ...(incluirSistema ? ["Movimento", "Saldo anterior", "Saldo posterior"] : []),
  ];

  const ajustesPorProduto = new Map(
    inventario.ajustes.map((ajuste) => [ajuste.id_produto, ajuste]),
  );
  const aprovadorInventario =
    inventario.usuarioAprovacao?.funcionario.pessoaFisica.nome ?? "";
  const dataInicio = inventario.data_inicio.toISOString().slice(0, 10);
  const dataFim = inventario.data_fim?.toISOString().slice(0, 10) ?? null;

  const registros = inventario.itens.map((item) => {
    const contagens = item.contagens
      .map(
        (contagem) =>
          `${contagem.funcionario.pessoaFisica.nome}: ${quantidadeCsv(Number(contagem.quantidade_contada))}`,
      )
      .join(" | ");
    const media = mediaContagens(
      item.contagens.map((contagem) => Number(contagem.quantidade_contada)),
    );
    const ajuste = ajustesPorProduto.get(item.id_produto);
    const movimento = ajuste?.movimentacoes[0];

    const registro: CelulaPlanilha[] = [
      inventario.id_inventario,
      inventario.observacao ?? null,
      ROTULOS_STATUS_INVENTARIO[inventario.status] ?? inventario.status,
      dataInicio,
      dataFim,
      formatarCodigo(item.id_produto),
      item.produto.descricao,
      ...(incluirSistema ? [Number(item.quantidade_sistema)] : []),
      contagens,
      media,
      item.origem ? (ROTULOS_ORIGEM_AJUSTE[item.origem] ?? item.origem) : null,
      ...(incluirSistema
        ? [
            item.quantidade_final === null ? null : Number(item.quantidade_final),
            ajuste
              ? (ROTULOS_STATUS_AJUSTE[ajuste.status] ?? ajuste.status)
              : "Sem ajuste",
          ]
        : []),
      ajuste?.justificativa ?? null,
      ajuste?.usuarioAprovacao?.funcionario.pessoaFisica.nome ??
        aprovadorInventario,
      ...(incluirSistema
        ? [
            movimento ? `#${movimento.id_movimentacao}` : null,
            movimento ? Number(movimento.saldo_anterior) : null,
            movimento ? Number(movimento.saldo_posterior) : null,
          ]
        : []),
    ];
    return registro;
  });

  return { cabecalho, registros };
}

/**
 * CSV do inventário fechado/cancelado. Uma linha por produto, com as contagens,
 * a decisão de ajuste e a movimentação vinculada. BOM UTF-8 e `;` para Excel pt-BR.
 */
﻿export function gerarCsvInventario(
  inventario: InventarioCompleto,
  opcoes: { incluirSistema?: boolean } = {},
): string {
  const tabela = tabelaInventario(inventario, opcoes);
  const celula = (valor: CelulaPlanilha): string => {
    if (valor === null) return "";
    return typeof valor === "number" ? quantidadeCsv(valor) : valor;
  };
  const corpo = [tabela.cabecalho, ...tabela.registros]
    .map((campos) => campos.map(celula).map(valorCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}
