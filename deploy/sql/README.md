# SQL de produção

Arquivos aplicados pelo instalador do Nexus com `mysql.exe` — **o destino não
executa Prisma**. O DDL é o mesmo do `prisma db push`, gerado a partir de
`prisma/schema.prisma`.

| Arquivo | Conteúdo |
| --- | --- |
| `schema.sql` | DDL completo (MySQL 8.4, `utf8mb4`), sem `CREATE DATABASE` |
| `seed.sql` | Dados de referência para **banco novo**: `tipo_codigo`, `tipo_destinatario`, `permissao`, `perfil`, `perfil_permissao`, `conversao_unidade` |
| `seed-update.sql` | **Atualização**: só o catálogo `permissao` e a limpeza das permissões obsoletas |
| `migracoes/001-unidades-pct10-cx50.sql` | renomeia `PACOTE`→`PCT10` e `CAIXA`→`CX50` em bancos antigos, preservando IDs |
| `migracoes/002-tipos-destinatario.sql` | cria o cadastro `tipo_destinatario`, mapeia o enum antigo e remove a coluna enum |
| `migracoes/003-condutor-tipos-produto-auxiliar.sql` | cria `tipo_produto`, os campos de condutor em `funcionario` e o auxiliar em `expedicao`, com índices/FKs idempotentes |

O seed não cria usuários, produtos, pedidos nem dados operacionais. O Super
Admin nasce no fluxo de primeiro acesso do próprio sistema.

**Banco novo recebe todos os cadastros de referência; atualização não.** Perfis,
tipos de código, tipos de destinatário e conversões de unidade são cadastros
editáveis — o usuário pode apagar todos. Por isso o Update aplica apenas as
migrações e o `seed-update.sql` (catálogo de permissões): nada apagado volta e
nenhum vínculo perfil↔permissão é refeito. Novas permissões de um release entram
no catálogo, mas não são concedidas automaticamente aos perfis existentes.

## Ordem de aplicação

Banco novo (instalação):

1. criar o banco (`utf8mb4`) e o usuário da aplicação;
2. `mysql --database <banco> < deploy/sql/schema.sql`;
3. `mysql --database <banco> < deploy/sql/seed.sql`.

Banco existente (aplicar **todas** as migrações em ordem, depois o seed de
atualização):

1. `mysql --database <banco> < deploy/sql/migracoes/001-unidades-pct10-cx50.sql`;
2. `mysql --database <banco> < deploy/sql/migracoes/002-tipos-destinatario.sql`;
3. `mysql --database <banco> < deploy/sql/migracoes/003-condutor-tipos-produto-auxiliar.sql`;
4. `mysql --database <banco> < deploy/sql/seed-update.sql`.

Ambos os seeds são idempotentes e podem ser reaplicados.

## Regenerar e validar

```bash
node scripts/gerar-sql-producao.mjs          # regenera schema.sql, seed.sql e seed-update.sql
node scripts/gerar-sql-producao.mjs --check  # valida num banco temporário
node scripts/gerar-sql-producao.mjs --all    # regenera e valida
```

A validação usa as credenciais de `DATABASE_URL`, cria um banco temporário
(`nexus_sql_test` por padrão), aplica schema+seed, confere 92 permissões,
2 perfis e as 3 conversões (`UNIDADE`/`PCT10`/`CX50`), reaplica o seed para
provar a idempotência, apaga os cadastros editáveis e confere que o
`seed-update.sql` mantém as 92 permissões sem recriar perfis, tipos, conversões
nem vínculos. O banco de `DATABASE_URL` nunca é o destino e nomes com `prod` são
recusados. `--check-db <nome>` troca o banco temporário e `--keep` o mantém para
inspeção. A senha vai ao cliente por `MYSQL_PWD` e não é impressa.

As contagens acima valem para o **banco novo** que a validação cria. Elas não são
pré-requisito de instalação nem de atualização: o `aplicar-sql.ps1` apenas
registra as contagens no log.
