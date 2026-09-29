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

  // idleTimeout recicla conexões ociosas após 3 min (evita pool leak em hot-reload)
  // acquireTimeout reduzido para falhar rápido em vez de travar 30s
  const adapter = new PrismaMariaDb(
    {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      connectTimeout: 10000,
      acquireTimeout: 5000,
      connectionLimit: 10,
      idleTimeout: 180,
      minDelayValidation: 1500,
      allowPublicKeyRetrieval: true,
    },
    { useTextProtocol: true },
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;