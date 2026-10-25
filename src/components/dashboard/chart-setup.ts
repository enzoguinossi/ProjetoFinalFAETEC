import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

// Só os elementos que os três gráficos do dashboard usam — o bundle do Chart.js
// cresce muito quando se registra o pacote inteiro.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

/** Cores dos tokens do projeto (`src/app/globals.css`). */
export const CORES_GRAFICO = {
  brand: "#1b9956",
  brandClaro: "rgba(27, 153, 86, 0.68)",
  warning: "#d97706",
  text: "#21272a",
  muted: "#8a8f9a",
  grid: "#dde1e6",
  superficie: "#f2f4f8",
} as const;

export const PALETA_SERIES = [
  "#1b9956",
  "#d97706",
  "#1a73e8",
  "#8a4baf",
  "#da1e28",
  "#5f6b7a",
] as const;

export const FONTE_GRAFICO = {
  family: "Inter, sans-serif",
  size: 11,
} as const;
