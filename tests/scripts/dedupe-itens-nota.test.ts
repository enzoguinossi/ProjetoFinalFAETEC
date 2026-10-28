import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deduplicar,
  detectarDuplicados,
  garantirBancoDeAplicacao,
} from "../../scripts/dedupe-itens-nota";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";
import { criarDestinatario, criarProduto, criarUsuario } from "../helpers/factories";

/**
 * Os testes rodam no `nexus_test`, sem as uniques que ainda não existem na
 * produção. Elas são removidas só durante este arquivo e recriadas no fim — é
 * exatamente o cenário do dedupe de release.
 */
const INDICES = [
  {
    tabela: "item_nota_entrada",
    nome: "item_nota_entrada_nota_produto_key",
    colunas: "ID_nota_entrada, ID_produto",
  },
  {
    tabela: "item_nota_saida",
    nome: "item_nota_saida_nota_produto_key",
    colunas: "ID_nota_saida, ID_produto",
  },
];

async function indiceExiste(tabela: string, nome: string) {
  const linhas = await prismaTeste.$queryRawUnsafe<{ Key_name: string }[]>(
    `SHOW INDEX FROM ${tabela} WHERE Key_name = '${nome}'`,
  );
  return linhas.length > 0;
}

async function removerIndices() {
  for (const indice of INDICES) {
    if (await indiceExiste(indice.tabela, indice.nome)) {
      await prismaTeste.$executeRawUnsafe(
        `ALTER TABLE ${indice.tabela} DROP INDEX ${indice.nome}`,
      );
    }
  }
}

async function recriarIndices() {
  for (const indice of INDICES) {
    if (!(await indiceExiste(indice.tabela, indice.nome))) {
      await prismaTeste.$executeRawUnsafe(
        `ALTER TABLE ${indice.tabela} ADD UNIQUE KEY ${indice.nome} (${indice.colunas})`,
      );
    }
  }
}

beforeAll(async () => {
  await removerIndices();
});

afterAll(async () => {
  await recriarIndices();
});

describe("dedupe de itens de nota", () => {
  it("--apply recusa banco que não é nexus_prod nem de teste", async () => {
    expect(() =>
      garantirBancoDeAplicacao("mysql://usuario:senha@localhost:3306/nexus"),
    ).toThrow(/nexus_prod/);
    expect(() =>
      garantirBancoDeAplicacao(
        "mysql://usuario:senha@localhost:3306/nexus_prod?connectionLimit=5",
      ),
    ).not.toThrow();
    await expect(
      deduplicar({
        aplicar: true,
        url: "mysql://usuario:senha@localhost:3306/nexus",
      }),
    ).rejects.toThrow(/nexus_prod/);
  });

  it("exige URL explícita ou DATABASE_URL (não lê o .env)", async () => {
    await expect(
      deduplicar({ aplicar: true, url: "" }),
    ).rejects.toThrow(/--url/);
  });

  it("consolida entrada e saída, preserva em auditoria/backup e é idempotente", async () => {
    const { usuario } = await criarUsuario();
    const produto = await criarProduto();
    const { destinatario } = await criarDestinatario();

    const entrada = await prismaTeste.notaEntrada.create({
      data: { data_criacao: new Date(), tipo: "ENTRADA" },
    });
    await prismaTeste.itemNotaEntrada.create({
      data: {
        id_nota_entrada: entrada.id_nota_entrada,
        id_produto: produto.id_produto,
        quantidade: 2,
        observacao: "lote A",
      },
    });
    await prismaTeste.itemNotaEntrada.create({
      data: {
        id_nota_entrada: entrada.id_nota_entrada,
        id_produto: produto.id_produto,
        quantidade: 3,
      },
    });

    const saida = await prismaTeste.notaSaida.create({
      data: {
        id_destinatario: destinatario.id_destinatario,
        data_criacao: new Date(),
        tipo: "SAIDA",
        status: "ABERTA",
      },
    });
    await prismaTeste.itemNotaSaida.create({
      data: {
        id_nota_saida: saida.id_nota_saida,
        id_produto: produto.id_produto,
        qtd_esperada: 4,
        qtd_entregue: 1,
        observacao: "frente",
      },
    });
    await prismaTeste.itemNotaSaida.create({
      data: {
        id_nota_saida: saida.id_nota_saida,
        id_produto: produto.id_produto,
        qtd_esperada: 6,
        qtd_entregue: 2,
      },
    });

    const antes = await detectarDuplicados();
    expect(antes.entrada).toHaveLength(1);
    expect(antes.entrada[0]!.ids).toHaveLength(2);
    expect(antes.saida).toHaveLength(1);
    expect(antes.saida[0]!.ids).toHaveLength(2);

    // Dry-run: relata e não altera nada.
    const dry = await deduplicar({});
    expect(dry.backup).toBeNull();
    expect(dry.entrada.linhasRemovidas).toBe(1);
    expect(dry.saida.linhasRemovidas).toBe(1);
    expect(await prismaTeste.itemNotaEntrada.count()).toBe(2);
    expect(await prismaTeste.itemNotaSaida.count()).toBe(2);

    const dir = await mkdtemp(path.join(tmpdir(), "nexus-dedupe-"));
    try {
      const resultado = await deduplicar({
        aplicar: true,
        idUsuario: usuario.id_usuario,
        backupDir: dir,
      });
      expect(resultado.entrada.linhasRemovidas).toBe(1);
      expect(resultado.saida.linhasRemovidas).toBe(1);
      expect(resultado.backup).toBeTruthy();

      const itensEntrada = await prismaTeste.itemNotaEntrada.findMany();
      expect(itensEntrada).toHaveLength(1);
      expect(Number(itensEntrada[0]!.quantidade)).toBe(5);
      expect(itensEntrada[0]!.observacao).toBe("lote A");

      const itensSaida = await prismaTeste.itemNotaSaida.findMany();
      expect(itensSaida).toHaveLength(1);
      expect(Number(itensSaida[0]!.qtd_esperada)).toBe(10);
      expect(Number(itensSaida[0]!.qtd_entregue)).toBe(3);
      expect(itensSaida[0]!.observacao).toBe("frente");

      const auditoriasEntrada = await auditoriasDe(
        "ItemNotaEntrada",
        itensEntrada[0]!.id_item_nota_entrada,
      );
      expect(auditoriasEntrada).toHaveLength(1);
      expect(auditoriasEntrada[0]!.acao).toBe("ALTERAR");
      expect(
        (auditoriasEntrada[0]!.dados_anteriores as { itens: unknown[] }).itens,
      ).toHaveLength(2);

      const auditoriasSaida = await auditoriasDe(
        "ItemNotaSaida",
        itensSaida[0]!.id_item_nota_saida,
      );
      expect(auditoriasSaida).toHaveLength(1);

      const backup = JSON.parse(await readFile(resultado.backup!, "utf8")) as {
        entrada: { linhas: unknown[] }[];
        saida: { linhas: unknown[] }[];
      };
      expect(backup.entrada[0]!.linhas).toHaveLength(2);
      expect(backup.saida[0]!.linhas).toHaveLength(2);

      const depois = await detectarDuplicados();
      expect(depois.entrada).toHaveLength(0);
      expect(depois.saida).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
