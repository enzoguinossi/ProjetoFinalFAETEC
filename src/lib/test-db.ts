// src/lib/test-db.ts

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "1234",
    database: "nexus",
    connectionLimit: 1,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Testando conexão...");

    const result = await prisma.$queryRaw`SELECT 1 AS ok`;

    console.log(result);

    await prisma.$disconnect();
}

main().catch(console.error);