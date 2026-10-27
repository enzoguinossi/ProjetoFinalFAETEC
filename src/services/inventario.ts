import { formatarCodigo } from "@/lib/formatar";
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
 * CSV do inventário fechado/cancelado. Uma linha por produto, com as contagens,
 * a decisão de ajuste e a movimentação vinculada. BOM UTF-8 e `;` para Excel pt-BR.
 */
﻿export function gerarCsvInventario(
  inventario: InventarioCompleto,
  opcoes: { incluirSistema?: boolean } = {},
): string {
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
  const dataFim = inventario.data_fim?.toISOString().slice(0, 10) ?? "";

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

    return [
      inventario.id_inventario,
      inventario.observacao ?? "",
      ROTULOS_STATUS_INVENTARIO[inventario.status] ?? inventario.status,
      dataInicio,
      dataFim,
      formatarCodigo(item.id_produto),
      item.produto.descricao,
      ...(incluirSistema ? [quantidadeCsv(Number(item.quantidade_sistema))] : []),
      contagens,
      quantidadeCsv(media),
      item.origem ? (ROTULOS_ORIGEM_AJUSTE[item.origem] ?? item.origem) : "",
      ...(incluirSistema
        ? [
            item.quantidade_final === null
              ? ""
              : quantidadeCsv(Number(item.quantidade_final)),
            ajuste
              ? (ROTULOS_STATUS_AJUSTE[ajuste.status] ?? ajuste.status)
              : "Sem ajuste",
          ]
        : []),
      ajuste?.justificativa ?? "",
      ajuste?.usuarioAprovacao?.funcionario.pessoaFisica.nome ??
        aprovadorInventario,
      ...(incluirSistema
        ? [
            movimento ? `#${movimento.id_movimentacao}` : "",
            movimento ? quantidadeCsv(Number(movimento.saldo_anterior)) : "",
            movimento ? quantidadeCsv(Number(movimento.saldo_posterior)) : "",
          ]
        : []),
    ];
  });

  const corpo = [cabecalho, ...registros]
    .map((campos) => campos.map(valorCsv).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}
