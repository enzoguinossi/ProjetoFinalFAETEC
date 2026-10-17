/**
 * Deve ser o PRIMEIRO import de qualquer entrada da ferramenta.
 *
 * Redireciona a `DATABASE_URL` para o banco isolado da exportação ANTES de
 * qualquer módulo da aplicação (`src/lib/prisma`) ser avaliado — o cliente
 * Prisma lê a variável no momento do import.
 *
 * Isso garante que a exportação nunca leia nem escreva no banco de desenvolvimento.
 */
import { exportDatabaseUrl } from "./config";

const url = exportDatabaseUrl();
process.env.DATABASE_URL = url;

/** Nome do banco em uso (sem credenciais) — só para log. */
export const EXPORT_DB_NAME_SHOWN = new URL(url).pathname.replace(/^\//, "");
