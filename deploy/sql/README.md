# SQL de produção

Arquivos aplicados pelo instalador do Nexus com `mysql.exe` — **o destino não
executa Prisma**. O DDL é o mesmo do `prisma db push`, gerado a partir de
`prisma/schema.prisma`.

| Arquivo | Conteúdo |
| --- | --- |
| `schema.sql` | DDL completo (MySQL 8.4, `utf8mb4`), sem `CREATE DATABASE` |
| `seed.sql` | Dados de referência idempotentes: `tipo_codigo`, `permissao`, `perfil`, `perfil_permissao`, `conversao_unidade` |
| `migracoes/001-unidades-pct10-cx50.sql` | renomeia `PACOTE`→`PCT10` e `CAIXA`→`CX50` em bancos antigos, preservando IDs |
| `migracoes/002-tipos-destinatario.sql` | cria o cadastro `tipo_destinatario`, mapeia o enum antigo e remove a coluna enum |

O seed não cria usuários, produtos, pedidos nem dados operacionais. O Super
Admin nasce no fluxo de primeiro acesso do próprio sistema.

## Ordem de aplicação

Banco novo (instalação):

1. criar o banco (`utf8mb4`) e o usuário da aplicação;
2. `mysql --database <banco> < deploy/sql/schema.sql`;
3. `mysql --database <banco> < deploy/sql/seed.sql`.

Banco existente criado com o seed antigo (aplicar **todas** as migrações em
ordem, depois o seed):

1. `mysql --database <banco> < deploy/sql/migracoes/001-unidades-pct10-cx50.sql`;
2. `mysql --database <banco> < deploy/sql/migracoes/002-tipos-destinatario.sql`;
3. `mysql --database <banco> < deploy/sql/seed.sql`.

O seed é idempotente e pode ser reaplicado: `INSERT ... ON DUPLICATE KEY UPDATE`
nos cadastros e `INSERT IGNORE` nos vínculos perfil↔permissão.

## Regenerar e validar

```bash
node scripts/gerar-sql-producao.mjs          # regenera schema.sql e seed.sql
node scripts/gerar-sql-producao.mjs --check  # valida num banco temporário
node scripts/gerar-sql-producao.mjs --all    # regenera e valida
```

A validação usa as credenciais de `DATABASE_URL`, cria um banco temporário
(`nexus_sql_test` por padrão), aplica schema+seed, confere 89 permissões,
2 perfis e as 3 conversões (`UNIDADE`/`PCT10`/`CX50`), reaplica o seed para
provar a idempotência e remove o banco no fim. O banco de `DATABASE_URL` nunca
é o destino e nomes com `prod` são recusados. `--check-db <nome>` troca o banco
temporário e `--keep` o mantém para inspeção. A senha vai ao cliente por
`MYSQL_PWD` e não é impressa.
