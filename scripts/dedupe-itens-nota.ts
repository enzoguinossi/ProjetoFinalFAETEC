import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Dedupe de itens de nota por nota/produto — etapa de release anterior ao
 * `prisma db push` que cria as uniques `item_nota_*_nota_produto_key`.
 *
 * Consolida cada grupo repetido na linha de menor id, somando as quantidades
 * (entrada: `quantidade`; saída: `qtd_esperada` e `qtd_entregue`) e juntando as
 * observações. As linhas removidas ficam preservadas na auditoria e em um
 * backup JSON. É **dry-run por padrão**; `--apply` grava o backup e aplica.
 *
 * Segurança: o script **não lê o `.env`**. A URL precisa vir de `--url` ou de
 * `DATABASE_URL` já definida no ambiente, e o banco é impresso no início.
 * `--apply` só aceita `nexus_prod` (ou um banco de teste, com "test" no nome).
 *
 * Uso:
 *   DATABASE_URL="mysql://..." npm run db:dedupe-notas            # dry-run
 *   DATABASE_URL="mysql://..." npm run db:dedupe-notas -- --apply
 *   npm run db:dedupe-notas -- --url "mysql://..." --apply --usuario 1
 */

export type GrupoEntrada = {
  id_nota_entrada: number;
  id_produto: number;
  ids: number[];
};

export type GrupoSaida = {
  id_nota_saida: number;
  id_produto: number;
  ids: number[];
};

export type ResultadoDedupe = {
  banco: string;
  entrada: { grupos: number; linhasRemovidas: number };
  saida: { grupos: number; linhasRemovidas: number };
  backup: string | null;
};

const NOME_PRODUCAO = "nexus_prod";

/** URL explícita (`--url`) ou `DATABASE_URL` do ambiente — nunca do `.env`. */
export function resolverUrl(url?: string): string {
  const bruta = (url ?? process.env.DATABASE_URL ?? "").trim();
  if (!bruta) {
    throw new Error(
      "Informe o banco: use --url \"mysql://...\" ou defina DATABASE_URL. " +
        "Este script não lê o .env (para não deduplicar o banco errado).",
    );
  }
  if (!/^(mysql|mariadb):\/\//i.test(bruta)) {
    throw new Error("A URL do banco deve começar com mysql:// ou mariadb://.");
  }
  return bruta;
}

export function nomeDoBanco(url: string): string {
  const semQuery = url.split("?")[0] ?? "";
  const partes = semQuery.split("/");
  return partes[partes.length - 1] ?? "";
}

/** `host:porta/banco`, sem expor usuário/senha. */
export function descricaoDoBanco(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "3306"}/${nomeDoBanco(url)}`;
}

/**
 * `--apply` só roda no banco de produção esperado ou em um banco de teste
 * (nome contendo "test"), como o `nexus_test`.
 */
export function garantirBancoDeAplicacao(url: string): void {
  const nome = nomeDoBanco(url);
  if (nome === NOME_PRODUCAO || nome.includes("test")) return;
  throw new Error(
    `--apply recusado para o banco "${nome}". Esperado "${NOME_PRODUCAO}" ` +
      "(ou um banco de teste, com \"test\" no nome). Confira a URL e o ambiente.",
  );
}

function criarCliente(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

async function gruposDuplicados(
  client: PrismaClient,
  tabela: "entrada" | "saida",
): Promise<{ id_nota: number; id_produto: number }[]> {
  const colunaNota = tabela === "saida" ? "ID_nota_saida" : "ID_nota_entrada";
  const linhas = await client.$queryRawUnsafe<
    { id_nota: number | bigint; id_produto: number | bigint }[]
  >(
    `SELECT ${colunaNota} AS id_nota, ID_produto AS id_produto
       FROM item_nota_${tabela}
      GROUP BY ${colunaNota}, ID_produto
     HAVING COUNT(*) > 1`,
  );
  return linhas.map((linha) => ({
    id_nota: Number(linha.id_nota),
    id_produto: Number(linha.id_produto),
  }));
}

async function linhasEntrada(client: PrismaClient, id_nota: number, id_produto: number) {
  return client.itemNotaEntrada.findMany({
    where: { id_nota_entrada: id_nota, id_produto },
    orderBy: { id_item_nota_entrada: "asc" },
  });
}

async function linhasSaida(client: PrismaClient, id_nota: number, id_produto: number) {
  return client.itemNotaSaida.findMany({
    where: { id_nota_saida: id_nota, id_produto },
    orderBy: { id_item_nota_saida: "asc" },
  });
}

function observacaoUnida(linhas: { observacao: string | null }[]): string | null {
  const textos = linhas
    .map((linha) => linha.observacao?.trim())
    .filter((texto): texto is string => Boolean(texto));
  return textos.length > 0 ? textos.join(" | ") : null;
}

async function detectarCom(client: PrismaClient): Promise<{
  entrada: GrupoEntrada[];
  saida: GrupoSaida[];
}> {
  const [entrada, saida] = await Promise.all([
    gruposDuplicados(client, "entrada"),
    gruposDuplicados(client, "saida"),
  ]);

  const entradaComIds = await Promise.all(
    entrada.map(async (grupo) => ({
      id_nota_entrada: grupo.id_nota,
      id_produto: grupo.id_produto,
      ids: (await linhasEntrada(client, grupo.id_nota, grupo.id_produto)).map(
        (linha) => linha.id_item_nota_entrada,
      ),
    })),
  );
  const saidaComIds = await Promise.all(
    saida.map(async (grupo) => ({
      id_nota_saida: grupo.id_nota,
      id_produto: grupo.id_produto,
      ids: (await linhasSaida(client, grupo.id_nota, grupo.id_produto)).map(
        (linha) => linha.id_item_nota_saida,
      ),
    })),
  );

  return { entrada: entradaComIds, saida: saidaComIds };
}

async function registrarAuditoriaDedupe(
  tx: Prisma.TransactionClient,
  idUsuario: number,
  entidade: string,
  idEntidade: number,
  anteriores: Record<string, unknown>,
  novos: Record<string, unknown>,
) {
  await tx.registroAuditoria.create({
    data: {
      id_usuario: idUsuario,
      acao: "ALTERAR",
      entidade,
      id_entidade_afetada: idEntidade,
      data_hora: new Date(),
      dados_anteriores: anteriores as Prisma.InputJsonValue,
      dados_novos: novos as Prisma.InputJsonValue,
    },
  });
}

async function usuarioParaAuditoria(
  client: PrismaClient,
  idInformado?: number,
): Promise<number> {
  if (idInformado) return idInformado;
  const admin = await client.usuario.findFirst({
    where: { super_admin: true },
    select: { id_usuario: true },
    orderBy: { id_usuario: "asc" },
  });
  if (admin) return admin.id_usuario;
  const primeiro = await client.usuario.findFirst({
    select: { id_usuario: true },
    orderBy: { id_usuario: "asc" },
  });
  if (!primeiro) {
    throw new Error(
      "Nenhum usuário para registrar a auditoria. Informe --usuario <id>.",
    );
  }
  return primeiro.id_usuario;
}

/** Detecta os grupos duplicados (somente leitura). */
export async function detectarDuplicados(
  opts: { url?: string } = {},
): Promise<{ entrada: GrupoEntrada[]; saida: GrupoSaida[] }> {
  const url = resolverUrl(opts.url);
  const client = criarCliente(url);
  try {
    return await detectarCom(client);
  } finally {
    await client.$disconnect();
  }
}

/**
 * Consolida os duplicados. Com `aplicar=false` (padrão) só relata. Com
 * `aplicar=true`, valida o banco (`nexus_prod`/teste), grava o backup JSON em
 * `backupDir` e aplica em transações por grupo.
 */
export async function deduplicar(
  opts: {
    url?: string;
    aplicar?: boolean;
    idUsuario?: number;
    backupDir?: string;
  } = {},
): Promise<ResultadoDedupe> {
  const url = resolverUrl(opts.url);
  const aplicar = opts.aplicar === true;
  if (aplicar) garantirBancoDeAplicacao(url);

  const client = criarCliente(url);
  try {
    const { entrada, saida } = await detectarCom(client);
    const resultado: ResultadoDedupe = {
      banco: descricaoDoBanco(url),
      entrada: { grupos: entrada.length, linhasRemovidas: 0 },
      saida: { grupos: saida.length, linhasRemovidas: 0 },
      backup: null,
    };

    const backupEntrada = await Promise.all(
      entrada.map(async (grupo) => ({
        grupo,
        linhas: await linhasEntrada(client, grupo.id_nota_entrada, grupo.id_produto),
      })),
    );
    const backupSaida = await Promise.all(
      saida.map(async (grupo) => ({
        grupo,
        linhas: await linhasSaida(client, grupo.id_nota_saida, grupo.id_produto),
      })),
    );

    if (entrada.length === 0 && saida.length === 0) return resultado;

    if (!aplicar) {
      resultado.entrada.linhasRemovidas = backupEntrada.reduce(
        (total, item) => total + Math.max(0, item.linhas.length - 1),
        0,
      );
      resultado.saida.linhasRemovidas = backupSaida.reduce(
        (total, item) => total + Math.max(0, item.linhas.length - 1),
        0,
      );
      return resultado;
    }

    const idUsuario = await usuarioParaAuditoria(client, opts.idUsuario);
    const dir = path.resolve(opts.backupDir ?? "backups");
    await mkdir(dir, { recursive: true });
    const carimbo = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "");
    const backupPath = path.join(dir, `dedupe-itens-nota-${carimbo}.json`);
    await writeFile(
      backupPath,
      JSON.stringify({ banco: resultado.banco, entrada: backupEntrada, saida: backupSaida }, null, 2),
      "utf8",
    );
    resultado.backup = backupPath;

    for (const { grupo, linhas } of backupEntrada) {
      const [manter, ...remover] = linhas;
      if (!manter || remover.length === 0) continue;

      const quantidade = linhas.reduce(
        (total, linha) => total + Number(linha.quantidade),
        0,
      );
      const observacao = observacaoUnida(linhas);

      await client.$transaction(async (tx) => {
        await tx.itemNotaEntrada.update({
          where: { id_item_nota_entrada: manter.id_item_nota_entrada },
          data: { quantidade, observacao },
        });
        await tx.itemNotaEntrada.deleteMany({
          where: {
            id_item_nota_entrada: { in: remover.map((l) => l.id_item_nota_entrada) },
          },
        });
        await registrarAuditoriaDedupe(
          tx,
          idUsuario,
          "ItemNotaEntrada",
          manter.id_item_nota_entrada,
          {
            motivo: "Dedupe de itens de nota (release)",
            nota: grupo.id_nota_entrada,
            produto: grupo.id_produto,
            itens: linhas.map((linha) => ({
              id_item_nota_entrada: linha.id_item_nota_entrada,
              quantidade: Number(linha.quantidade),
              observacao: linha.observacao,
            })),
          },
          {
            id_item_nota_entrada: manter.id_item_nota_entrada,
            quantidade,
            observacao,
            removidos: remover.map((linha) => linha.id_item_nota_entrada),
          },
        );
      });

      resultado.entrada.linhasRemovidas += remover.length;
    }

    for (const { grupo, linhas } of backupSaida) {
      const [manter, ...remover] = linhas;
      if (!manter || remover.length === 0) continue;

      const qtdEsperada = linhas.reduce(
        (total, linha) => total + Number(linha.qtd_esperada),
        0,
      );
      const qtdEntregue = linhas.reduce(
        (total, linha) => total + Number(linha.qtd_entregue),
        0,
      );
      const observacao = observacaoUnida(linhas);

      await client.$transaction(async (tx) => {
        await tx.itemNotaSaida.update({
          where: { id_item_nota_saida: manter.id_item_nota_saida },
          data: { qtd_esperada: qtdEsperada, qtd_entregue: qtdEntregue, observacao },
        });
        await tx.itemNotaSaida.deleteMany({
          where: {
            id_item_nota_saida: { in: remover.map((l) => l.id_item_nota_saida) },
          },
        });
        await registrarAuditoriaDedupe(
          tx,
          idUsuario,
          "ItemNotaSaida",
          manter.id_item_nota_saida,
          {
            motivo: "Dedupe de itens de nota (release)",
            nota: grupo.id_nota_saida,
            produto: grupo.id_produto,
            itens: linhas.map((linha) => ({
              id_item_nota_saida: linha.id_item_nota_saida,
              qtd_esperada: Number(linha.qtd_esperada),
              qtd_entregue: Number(linha.qtd_entregue),
              observacao: linha.observacao,
            })),
          },
          {
            id_item_nota_saida: manter.id_item_nota_saida,
            qtd_esperada: qtdEsperada,
            qtd_entregue: qtdEntregue,
            observacao,
            removidos: remover.map((linha) => linha.id_item_nota_saida),
          },
        );
      });

      resultado.saida.linhasRemovidas += remover.length;
    }

    return resultado;
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--apply");
  const indice = (flag: string) => args.indexOf(flag);
  const valor = (flag: string) =>
    indice(flag) >= 0 ? args[indice(flag) + 1] : undefined;
  const url = valor("--url") ?? process.env.DATABASE_URL;
  const resolvida = resolverUrl(url);
  const idUsuario = valor("--usuario") ? Number(valor("--usuario")) : undefined;
  const backupDir = valor("--backup-dir");

  console.log(`Banco: ${descricaoDoBanco(resolvida)}`);
  console.log(aplicar ? "Modo: --apply (backup + consolidação)" : "Modo: dry-run");
  if (aplicar) garantirBancoDeAplicacao(resolvida);

  const resultado = await deduplicar({ url: resolvida, aplicar, idUsuario, backupDir });
  console.log(
    `Duplicados: entrada=${resultado.entrada.grupos} grupo(s), saída=${resultado.saida.grupos} grupo(s).`,
  );
  if (!aplicar) {
    console.log(
      `Dry-run: ${resultado.entrada.linhasRemovidas + resultado.saida.linhasRemovidas} linha(s) seriam consolidada(s). Nada foi alterado. Use --apply para aplicar.`,
    );
    return;
  }
  console.log(
    `Aplicado: entrada=${resultado.entrada.linhasRemovidas} linha(s) removida(s); ` +
      `saída=${resultado.saida.linhasRemovidas} linha(s) removida(s).`,
  );
  console.log(
    resultado.backup ? `Backup: ${resultado.backup}` : "Nada a consolidar; sem backup.",
  );
}

const executadoDireto =
  process.argv[1] !== undefined &&
  /dedupe-itens-nota\.(ts|js)$/.test(process.argv[1].replace(/\\/g, "/"));

if (executadoDireto) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
