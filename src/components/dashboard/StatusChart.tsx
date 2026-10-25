"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import "./chart-setup";
import { CORES_GRAFICO, FONTE_GRAFICO, PALETA_SERIES } from "./chart-setup";

type Props = {
  status: { status: string; label: string; total: number }[];
  semPermissao?: boolean;
};

export default function StatusChart({ status, semPermissao }: Props) {
  const data: ChartData<"doughnut"> = {
    labels: status.map((item) => item.label),
    datasets: [
      {
        label: "Notas de saída",
        data: status.map((item) => item.total),
        backgroundColor: status.map(
          (_, indice) => PALETA_SERIES[indice % PALETA_SERIES.length],
        ),
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, color: CORES_GRAFICO.text, font: FONTE_GRAFICO },
      },
    },
  };

  return (
    <section
      className="bg-white rounded-xl border border-border p-4"
      data-figma="StatusChart"
    >
      <h3 className="text-[0.8125rem] font-semibold mb-2">
        Notas de saída por status
      </h3>
      <div className="h-[220px]">
        {semPermissao ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem permissão para ver notas de saída.
          </p>
        ) : status.length === 0 ? (
          <p className="m-0 h-full flex items-center justify-center text-xs text-[#8a8f9a]">
            Sem notas de saída cadastradas.
          </p>
        ) : (
          <Doughnut data={data} options={options} aria-label="Notas de saída por status" />
        )}
      </div>
    </section>
  );
}
