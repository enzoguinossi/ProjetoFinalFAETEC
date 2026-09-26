import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function parseMysqlUrl(url: string) {
  // mysql://user:pass@host:port/database?params
  const pattern = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = url.match(pattern);
  if (!match) throw new Error("DATABASE_URL inválida");
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: Number(match[4]),
    database: match[5],
  };
}

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");

  const parsed = parseMysqlUrl(url);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const adapter = new PrismaMariaDb(
    {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      connectTimeout: 30000,
      acquireTimeout: 30000,
      connectionLimit: 10,
    },
    { useTextProtocol: true },
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;