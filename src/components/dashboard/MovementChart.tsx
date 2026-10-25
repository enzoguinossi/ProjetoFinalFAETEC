"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import "./chart-setup";
import { CORES_GRAFICO, FONTE_GRAFICO } from "./chart-setup";

type Props = {
  labels: string[];
  entradas: number[];
  saidas: number[];
  semPermissao?: boolean;
};

export default function MovementChart({ labels, entradas, saidas, semPermissao }: Props) {
  const semDados =
    entradas.every((valor) => valor === 0) && saidas.every((valor) => valor === 0);

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: entradas,
        backgroundColor: CORES_GRAFICO.brand,
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: "Saídas",
        data: saidas,
        backgroundColor: CORES_GRAFICO.warning,
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, color: CORES_GRAFICO.text, font: FONTE_GRAFICO },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: CORES_GRAFICO.muted, font: FONTE_GRAFICO },
      },
      y: {
        beginAtZero: true,
        grid: { color: CORES_GRAFICO.grid },
        ticks: {
          color: CORES_GRAFICO.muted,
          font: FONTE_GRAFICO,
          precision: 0,
        },
      },
    },
  };

  return (
    <section
      className="bg-white rounded-xl border border-border p-4"
      data-figma="MovementChart"
    >
      <h3 className="text-[0.8125rem] font-semibold mb-2">
        Movimentações — últimos 6 meses
      </h3>
      <div className="h-[220px]">
        {semPermissao ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem permissão para ver movimentações.
          </p>
        ) : semDados ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem movimentações no período.
          </p>
        ) : (
          <Bar data={data} options={options} aria-label="Entradas e saídas por mês" />
        )}
      </div>
    </section>
  );
}
