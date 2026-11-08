#!/usr/bin/env node
/**
 * Gera o SQL de produção do Nexus (sem Prisma no destino).
 *
 *   node scripts/gerar-sql-producao.mjs          # regenera schema.sql e seed.sql
 *   node scripts/gerar-sql-producao.mjs --check  # valida os arquivos num banco temporário
 *   node scripts/gerar-sql-producao.mjs --all    # regenera e valida
 *
 * `schema.sql` vem de `prisma migrate diff --from-empty --to-schema` (mesmo DDL
 * do `prisma db push`), sem `CREATE DATABASE`. `seed.sql` é gerado a partir da
 * lista de referência abaixo — a mesma do `prisma/seed.ts` — e é idempotente:
 * `INSERT ... ON DUPLICATE KEY UPDATE` para cadastros e `INSERT IGNORE` para os
 * vínculos perfil↔permissão.
 *
 * A validação (`--check`) cria um banco temporário (padrão `nexus_sql_test`) com
 * as credenciais de `DATABASE_URL`, aplica schema+seed, confere as contagens,
 * reaplica o seed e confere que nada duplicou. O banco de `DATABASE_URL` nunca é
 * usado como destino e `nexus_prod` é recusado. A senha nunca é impressa: vai
 * ao cliente MySQL por `MYSQL_PWD`.
 *
 * O destino (instalador) NÃO executa Prisma: usa apenas `mysql.exe` com os
 * arquivos de `deploy/sql/`.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DIR = path.join(ROOT, "deploy", "sql");
const SCHEMA_FILE = path.join(SQL_DIR, "schema.sql");
const SEED_FILE = path.join(SQL_DIR, "seed.sql");
const SCHEMA_MODEL = "prisma/schema.prisma";

// ── Dados de referência (espelham prisma/seed.ts) ───────────────────────────

const TIPOS_CODIGO = [
  ["DIGITACAO", "Apelido livre para digitação rápida"],
  ["EAN12", "GTIN-12 / UPC-A — 12 dígitos numéricos"],
  ["EAN13", "GTIN-13 / EAN-13 — 13 dígitos numéricos"],
  ["COD_FORNECEDOR", "Código do produto no fornecedor"],
  ["COD_ESCOLA", "Código da escola/creche"],
  ["MATRICULA", "Matrícula funcional do funcionário"],
];

// Tipos de escola de referência; só são inseridos quando a tabela está vazia.
const TIPOS_DESTINATARIO = [
  ["ESCOLA", "Escola", true],
  ["CRECHE", "Creche", false],
  ["CMEI", "CMEI", false],
  ["CMEIA", "CMEIA", false],
];

function listaPermissoes() {
  const entidadesCadastro = [
    "usuario",
    "funcionario",
    "destinatario",
    "fornecedor",
    "veiculo",
    "produto",
  ];
  const entidadesComPerfil = [...entidadesCadastro, "perfil"];

  return [
    ...entidadesComPerfil.flatMap((e) => [
      `${e}.listar`,
      `${e}.criar`,
      `${e}.alterar`,
      `${e}.consultar`,
    ]),
    ...entidadesCadastro.map((e) => `${e}.desativar`),
    ...entidadesCadastro.map((e) => `${e}.excluir`),
    "perfil.excluir",
    "produto.ver_inativos",
    "unidade_conversao.listar",
    "unidade_conversao.criar",
    "unidade_conversao.alterar",
    "unidade_conversao.consultar",
    "unidade_conversao.excluir",
    "tipo_destinatario.criar",
    "tipo_destinatario.alterar",
    "tipo_destinatario.excluir",
    "estoque.entrada",
    "estoque.saida",
    "estoque.ver_saldo",
    "nota_entrada.criar",
    "nota_entrada.alterar",
    "nota_entrada.consultar",
    "nota_entrada.cancelar",
    "nota_saida.criar",
    "nota_saida.alterar",
    "nota_saida.consultar",
    "nota_saida.cancelar",
    "nota_saida.alterar_status",
    "nota_saida.finalizar",
    "percurso.listar",
    "percurso.criar",
    "percurso.alterar",
    "percurso.consultar",
    "percurso.excluir",
    "expedicao.listar",
    "expedicao.criar",
    "expedicao.alterar",
    "expedicao.consultar",
    "expedicao.desativar",
    "inventario.abrir",
    "inventario.contar",
    "inventario.aprovar_ajuste",
    "pedido.listar",
    "pedido.criar",
    "pedido.alterar",
    "pedido.consultar",
    "pedido.aprovar",
    "relatorio.gerar",
    "mural.criar",
    "mural.alterar",
    "mural.excluir",
    "backup.listar",
    "backup.executar",
    "backup.agendar",
    "backup.restaurar",
  ];
}

// Nomes de modelos antigos (remessa/rota) e permissões que não existem mais.
// Mantidos para limpar bancos que ainda os tenham, como no seed.ts.
const PERMISSOES_OBSOLETAS = [
  "perfil.desativar",
  "percurso.desativar",
  "rota.listar",
  "rota.criar",
  "rota.alterar",
  "rota.consultar",
  "rota.desativar",
  "remessa.criar",
  "remessa.alterar",
  "remessa.alterar_status",
  "remessa.consultar",
  "remessa.finalizar",
];

const PERFIS = [
  {
    nome: "Operador",
    descricao: "Operador do galpão",
    permissoes: [
      "produto.consultar",
      "produto.criar",
      "estoque.entrada",
      "estoque.ver_saldo",
      "nota_saida.criar",
      "nota_saida.consultar",
      "nota_saida.alterar",
      "nota_saida.alterar_status",
      "nota_saida.finalizar",
      "destinatario.consultar",
      "inventario.contar",
    ],
  },
  {
    nome: "Auxiliar",
    descricao: "Auxiliar administrativo",
    permissoes: [
      "nota_saida.consultar",
      "nota_saida.alterar",
      "estoque.ver_saldo",
      "estoque.saida",
      "produto.consultar",
      "inventario.contar",
      "relatorio.gerar",
    ],
  },
];

const CONVERSOES = [
  ["UNIDADE", 1, "Unidade avulsa", true],
  ["PCT10", 10, "Pacote com 10 unidades", false],
  ["CX50", 50, "Caixa com 50 unidades", false],
];

// ── Geração ────────────────────────────────────────────────────────────────

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function inList(values) {
  return values.map(q).join(", ");
}

function gerarSchema() {
  const prismaCli = require.resolve("prisma/build/index.js");
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@127.0.0.1:3306/placeholder",
  };
  const ddl = execFileSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      SCHEMA_MODEL,
      "--script",
    ],
    { cwd: ROOT, env, encoding: "utf8" },
  );

  if (/\bCREATE\s+DATABASE\b/i.test(ddl)) {
    throw new Error("O DDL gerado contém CREATE DATABASE; remova antes de publicar.");
  }

  const header = [
    "-- Nexus — esquema físico do banco (MySQL 8.4, utf8mb4).",
    `-- Gerado por scripts/gerar-sql-producao.mjs a partir de ${SCHEMA_MODEL}.`,
    "-- Aplicar em um banco vazio e já criado; não cria o banco nem usuários.",
    "-- Equivalente ao DDL do `prisma db push` (o destino não usa Prisma).",
    "",
    "SET NAMES utf8mb4;",
    "",
    "",
  ].join("\n");

  return `${header}${ddl.trimEnd()}\n`;
}

function gerarSeed() {
  const permissoes = listaPermissoes();
  const linhas = [
    "-- Nexus — seed de referência (sem usuários, produtos ou dados operacionais).",
    "-- Gerado por scripts/gerar-sql-producao.mjs a partir da lista de referência do",
    "-- prisma/seed.ts. Idempotente: pode ser reaplicado sem duplicar.",
    "",
    "SET NAMES utf8mb4;",
    "",
    "-- ── Tipos de código ────────────────────────────────────────────────────────",
    "INSERT INTO `tipo_codigo` (`nome`, `descricao`, `ativo`) VALUES",
    TIPOS_CODIGO.map(([nome, descricao]) => `  (${q(nome)}, ${q(descricao)}, TRUE)`).join(",\n"),
    "AS new",
    "ON DUPLICATE KEY UPDATE `descricao` = new.`descricao`, `ativo` = new.`ativo`;",
    "",
    "-- ── Tipos de destinatário (só quando o cadastro está vazio) ────────────────",
    "SET @qtd_tipo_destinatario = (SELECT COUNT(*) FROM `tipo_destinatario`);",
    "INSERT INTO `tipo_destinatario` (`codigo`, `nome`, `padrao`)",
    "SELECT `codigo`, `nome`, `padrao` FROM (",
    TIPOS_DESTINATARIO.map(
      ([codigo, nome, padrao]) =>
        `  SELECT ${q(codigo)} AS \`codigo\`, ${q(nome)} AS \`nome\`, ${padrao ? "TRUE" : "FALSE"} AS \`padrao\``,
    ).join(" UNION ALL\n"),
    ") AS novos",
    "WHERE @qtd_tipo_destinatario = 0;",
    "",
    "-- ── Permissões (entidade.acao) ─────────────────────────────────────────────",
    "INSERT INTO `permissao` (`nome`, `ativo`) VALUES",
    permissoes.map((nome) => `  (${q(nome)}, TRUE)`).join(",\n"),
    "AS new",
    "ON DUPLICATE KEY UPDATE `ativo` = new.`ativo`;",
    "",
    "-- ── Limpeza de permissões obsoletas (modelos antigos remessa/rota) ─────────",
    `DELETE FROM \`usuario_permissao\` WHERE \`ID_permissao\` IN (SELECT \`ID_permissao\` FROM \`permissao\` WHERE \`nome\` IN (${inList(PERMISSOES_OBSOLETAS)}));`,
    `DELETE FROM \`perfil_permissao\` WHERE \`ID_permissao\` IN (SELECT \`ID_permissao\` FROM \`permissao\` WHERE \`nome\` IN (${inList(PERMISSOES_OBSOLETAS)}));`,
    `DELETE FROM \`permissao\` WHERE \`nome\` IN (${inList(PERMISSOES_OBSOLETAS)});`,
    "",
    "-- ── Perfis-template ────────────────────────────────────────────────────────",
    "INSERT INTO `perfil` (`nome`, `descricao`) VALUES",
    PERFIS.map((p) => `  (${q(p.nome)}, ${q(p.descricao)})`).join(",\n"),
    "AS new",
    "ON DUPLICATE KEY UPDATE `descricao` = new.`descricao`;",
    "",
  ];

  for (const perfil of PERFIS) {
    linhas.push(
      `-- ${perfil.nome}`,
      "INSERT IGNORE INTO `perfil_permissao` (`ID_perfil`, `ID_permissao`)",
      "SELECT p.`ID_perfil`, pe.`ID_permissao`",
      "FROM `perfil` p",
      "CROSS JOIN `permissao` pe",
      `WHERE p.\`nome\` = ${q(perfil.nome)} AND pe.\`nome\` IN (${inList(perfil.permissoes)});`,
      "",
    );
  }

  linhas.push(
    "-- ── Unidades de conversão ──────────────────────────────────────────────────",
    "-- UNIDADE (fator 1) é a única padrão do sistema; PCT10/CX50 são auxílios.",
    "INSERT INTO `conversao_unidade` (`nome`, `fator`, `descricao`, `padrao`) VALUES",
    CONVERSOES.map(
      ([nome, fator, descricao, padrao]) =>
        `  (${q(nome)}, ${fator}, ${q(descricao)}, ${padrao ? "TRUE" : "FALSE"})`,
    ).join(",\n"),
    "AS new",
    "ON DUPLICATE KEY UPDATE `fator` = new.`fator`, `descricao` = new.`descricao`, `padrao` = new.`padrao`;",
    "",
    "-- Invariante: apenas a UNIDADE é padrão.",
    "UPDATE `conversao_unidade` SET `padrao` = (`nome` = 'UNIDADE');",
    "",
  );

  return linhas.join("\n");
}

function gerarArquivos() {
  fs.mkdirSync(SQL_DIR, { recursive: true });
  fs.mkdirSync(path.join(SQL_DIR, "migracoes"), { recursive: true });

  const schema = gerarSchema();
  fs.writeFileSync(SCHEMA_FILE, schema, "utf8");
  console.log(`schema.sql: ${path.relative(ROOT, SCHEMA_FILE)} (${schema.length} bytes)`);

  const seed = gerarSeed();
  fs.writeFileSync(SEED_FILE, seed, "utf8");
  console.log(`seed.sql:   ${path.relative(ROOT, SEED_FILE)} (${seed.length} bytes)`);
}

// ── Validação em banco temporário ──────────────────────────────────────────

function parseMysqlUrl(url) {
  const match = /^(?:mysql|mariadb):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/.exec(url ?? "");
  if (!match) throw new Error("DATABASE_URL inválida ou ausente para a validação.");
  return { user: match[1], password: match[2], host: match[3], port: match[4], database: match[5] };
}

function localizarMysql() {
  if (process.env.MYSQL_CLI) return process.env.MYSQL_CLI;

  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const candidates = [
    path.join(programFiles, "MySQL", "MySQL Server 8.4", "bin", "mysql.exe"),
    path.join(programFiles, "MySQL", "MySQL Server 8.0", "bin", "mysql.exe"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    execFileSync("mysql", ["--version"], { stdio: "ignore" });
    return "mysql";
  } catch {
    throw new Error("mysql.exe não encontrado. Defina MYSQL_CLI com o caminho do cliente.");
  }
}

function validar() {
  const argu = process.argv.slice(2);
  const keep = argu.includes("--keep");
  const dbIndex = argu.indexOf("--check-db");
  const checkDb = dbIndex >= 0 ? argu[dbIndex + 1] : "nexus_sql_test";

  if (!checkDb || !/^[A-Za-z0-9_]+$/.test(checkDb)) {
    throw new Error(`Nome de banco temporário inválido: ${checkDb ?? "(ausente)"}`);
  }
  const conexao = parseMysqlUrl(process.env.DATABASE_URL);
  if (checkDb === conexao.database) {
    throw new Error("O banco de validação não pode ser o banco de DATABASE_URL.");
  }
  if (/prod/i.test(checkDb)) {
    throw new Error("O banco de validação não pode conter 'prod' no nome.");
  }
  for (const file of [SCHEMA_FILE, SEED_FILE]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Arquivo ausente: ${path.relative(ROOT, file)}. Rode a geração primeiro.`);
    }
  }

  const mysql = localizarMysql();
  const base = [
    "--protocol=TCP",
    "-h",
    conexao.host,
    "-P",
    conexao.port,
    "-u",
    conexao.user,
    "--default-character-set=utf8mb4",
  ];
  const env = { ...process.env, MYSQL_PWD: conexao.password };

  const consultar = (sql, database = checkDb) =>
    execFileSync(mysql, [...base, "--database", database, "--batch", "--skip-column-names", "-e", sql], {
      env,
      encoding: "utf8",
    }).trim();

  const aplicar = (arquivo, database = checkDb) => {
    const fd = fs.openSync(arquivo, "r");
    try {
      execFileSync(mysql, [...base, "--database", database], {
        env,
        stdio: [fd, "inherit", "inherit"],
      });
    } finally {
      fs.closeSync(fd);
    }
  };

  const aplicarSemBanco = (sql) =>
    execFileSync(mysql, [...base, "--batch", "--skip-column-names", "-e", sql], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
    });

  console.log(`==> Validando em ${checkDb} (${conexao.host}:${conexao.port})`);
  aplicarSemBanco(
    `DROP DATABASE IF EXISTS \`${checkDb}\`; CREATE DATABASE \`${checkDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  );

  try {
    aplicar(SCHEMA_FILE);
    console.log("  schema.sql aplicado");

    const fotografar = () => ({
      permissoes: consultar("SELECT COUNT(*) FROM `permissao`"),
      perfis: consultar("SELECT COUNT(*) FROM `perfil`"),
      vinculos: consultar("SELECT COUNT(*) FROM `perfil_permissao`"),
      conversoes: consultar(
        "SELECT GROUP_CONCAT(CONCAT(`nome`, ':', `fator`, ':', `padrao`) ORDER BY `fator` SEPARATOR ',') FROM `conversao_unidade`",
      ),
      tipos: consultar("SELECT COUNT(*) FROM `tipo_codigo`"),
      tiposDestinatario: consultar("SELECT COUNT(*) FROM `tipo_destinatario`"),
    });

    aplicar(SEED_FILE);
    const primeira = fotografar();
    console.log(`  seed.sql aplicado: ${JSON.stringify(primeira)}`);

    aplicar(SEED_FILE);
    const segunda = fotografar();
    console.log(`  seed.sql reaplicado: ${JSON.stringify(segunda)}`);

    const erros = [];
    if (primeira.permissoes !== "89") erros.push(`permissões: ${primeira.permissoes} (esperado 89)`);
    if (primeira.perfis !== "2") erros.push(`perfis: ${primeira.perfis} (esperado 2)`);
    if (primeira.conversoes !== "UNIDADE:1:1,PCT10:10:0,CX50:50:0") {
      erros.push(`conversões: ${primeira.conversoes}`);
    }
    if (primeira.tipos !== "6") erros.push(`tipos de código: ${primeira.tipos} (esperado 6)`);
    if (primeira.tiposDestinatario !== "4") {
      erros.push(`tipos de escola: ${primeira.tiposDestinatario} (esperado 4)`);
    }
    if (JSON.stringify(primeira) !== JSON.stringify(segunda)) {
      erros.push("o seed duplicou dados na segunda aplicação");
    }
    if (erros.length > 0) throw new Error(`Validação falhou:\n  - ${erros.join("\n  - ")}`);

    console.log("  OK: 89 permissões, 2 perfis, 3 conversões (UNIDADE/PCT10/CX50), 4 tipos de escola, seed idempotente");
  } finally {
    if (keep) {
      console.log(`  banco mantido: ${checkDb}`);
    } else {
      aplicarSemBanco(`DROP DATABASE IF EXISTS \`${checkDb}\`;`);
      console.log(`  banco temporário ${checkDb} removido`);
    }
  }
}

// ── Entrada ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const check = args.includes("--check");
const all = args.includes("--all");

if (check || all) {
  if (all) gerarArquivos();
  validar();
} else {
  gerarArquivos();
}
