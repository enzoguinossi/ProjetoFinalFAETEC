import { execSync } from "node:child_process";
import "dotenv/config";
import { urlDeTeste } from "./helpers/database-url";

export default function setup() {
  const url = urlDeTeste();
  execSync("npx prisma db push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
