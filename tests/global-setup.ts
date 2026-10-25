import { execSync } from "node:child_process";
import "dotenv/config";
import { urlDeTeste } from "./helpers/database-url";

export default function setup() {
  const url = urlDeTeste();
  // O banco de testes é descartável e é limpo antes de cada teste; por isso o
  // `--accept-data-loss` é seguro aqui. Sem ele, a criação de um índice único
  // (ex.: `mensagem_mural.chave`) faz o Prisma pedir confirmação e o Vitest
  // falha antes de rodar qualquer teste.
  execSync("npx prisma db push --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
