import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { urlDeTeste } from "./database-url";

/**
 * Registro de driver adapters por scheme de URL.
 *
 * O Prisma 7 exige um driver adapter por provider. Os testes usam somente a API
 * do Prisma Client; para trocar de SGBD, instale o adapter oficial e registre-o
 * aqui — nenhum teste precisa mudar.
 */
function criarAdapter(url: string) {
  const scheme = new URL(url).protocol;
  switch (scheme) {
    case "mysql:":
    case "mariadb:":
      return new PrismaMariaDb(url);
    default:
      throw new Error(
        `Nenhum driver adapter registrado para "${scheme}". ` +
          "Instale o adapter oficial (ex.: @prisma/adapter-pg) e registre-o em tests/helpers/prisma.ts.",
      );
  }
}

export const prismaTeste = new PrismaClient({ adapter: criarAdapter(urlDeTeste()) });
