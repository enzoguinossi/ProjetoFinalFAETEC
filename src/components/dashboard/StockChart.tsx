"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import "./chart-setup";
import { CORES_GRAFICO, FONTE_GRAFICO } from "./chart-setup";

type Props = {
  produtos: { descricao: string; unidade: string; quantidade: number }[];
  semPermissao?: boolean;
};

/** O eixo do gráfico é estreito: encurta a descrição e deixa a unidade na 2ª linha. */
function rotuloProduto(descricao: string, unidade: string): string {
  const nome = descricao.length > 16 ? `${descricao.slice(0, 15)}…` : descricao;
  return `${nome}\n(${unidade})`;
}

export default function StockChart({ produtos, semPermissao }: Props) {
  const labels = produtos.map((produto) =>
    rotuloProduto(produto.descricao, produto.unidade),
  );

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Quantidade atual",
        data: produtos.map((produto) => produto.quantidade),
        backgroundColor: CORES_GRAFICO.brandClaro,
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: CORES_GRAFICO.grid },
        ticks: {
          color: CORES_GRAFICO.muted,
          font: FONTE_GRAFICO,
          precision: 0,
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: CORES_GRAFICO.text,
          font: { ...FONTE_GRAFICO, size: 10 },
          autoSkip: false,
        },
      },
    },
  };

  return (
    <section
      className="bg-white rounded-xl border border-border p-4"
      data-figma="StockChart"
    >
      <h3 className="text-[0.8125rem] font-semibold mb-2">
        Top 5 produtos por estoque
      </h3>
      <div className="h-[220px]">
        {semPermissao ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem permissão para ver o saldo de estoque.
          </p>
        ) : produtos.length === 0 ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem produtos com saldo em estoque.
          </p>
        ) : (
          <Bar data={data} options={options} aria-label="Top 5 produtos por estoque" />
        )}
      </div>
    </section>
  );
}
