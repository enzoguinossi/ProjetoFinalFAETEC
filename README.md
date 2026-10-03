# Projeto Final FAETEC — Nexus

Sistema de Controle de Estoque e Logística de Remessas para galpão logístico — distribuição de materiais para 105+ escolas municipais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Stack** | Next.js 14+ (App Router) — Full Stack |
| **ORM** | Prisma 7 |
| **Banco** | MySQL |
| **Autenticação** | Feita na mão (bcrypt + JWT via `jose`, HS256) |
| **Versionamento** | GitHub |

## Estrutura

```
projeto-final-faetec/
├── src/
│   ├── app/           # Next.js App Router + Route Handlers
│   ├── dao/           # Data Access Objects (Prisma queries)
│   ├── services/      # Lógica de negócio
│   ├── lib/           # Utilitários (prisma client, config)
│   ├── components/    # Componentes React
│   └── types/         # Tipos e constantes
├── prisma/
│   ├── schema.prisma  # Modelo de dados (54 entidades)
│   └── seed.ts        # Seed inicial
├── prisma.config.ts   # Configuração do Prisma 7
├── docs/              # Documentação e diagramas
│   ├── ENTENDIMENTO.md
│   ├── REQUISITOS_FUNCIONAIS.md
│   ├── REGRAS_NEGOCIO.md
│   ├── REQUISITOS_NAO_FUNCIONAIS.md
│   └── puml/          # Diagramas PlantUML
├── bruno/             # Collection de APIs (Bruno)
├── AGENTS.md          # Convenções do projeto
└── package.json
```

## Documentação

- [`docs/ENTENDIMENTO.md`](docs/ENTENDIMENTO.md) — Especificação completa do modelo de dados
- [`docs/REQUISITOS_FUNCIONAIS.md`](docs/REQUISITOS_FUNCIONAIS.md) — 25 RFs
- [`docs/REGRAS_NEGOCIO.md`](docs/REGRAS_NEGOCIO.md) — 5 RNs
- [`docs/REQUISITOS_NAO_FUNCIONAIS.md`](docs/REQUISITOS_NAO_FUNCIONAIS.md) — 9 RNFs
- [`docs/puml/classes.puml`](docs/puml/classes.puml) — Diagrama de classes conceitual
- [`docs/puml/DER.puml`](docs/puml/DER.puml) — Diagrama Entidade-Relacionamento físico

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Configurar banco
cp .env.example .env   # editar credenciais MySQL
npx prisma db push     # criar tabelas
npx prisma generate    # gerar client

# Iniciar dev
npm run dev
```

## Docker

Sobe a aplicação + MySQL sem precisar configurar nada localmente:

```bash
# Defina o segredo dos JWT (obrigatório)
export JWT_SECRET="um-segredo-forte-e-unico"

docker compose up --build
```

Acesse em `http://localhost:3000`.

- O Compose monta a `DATABASE_URL` automaticamente a partir das variáveis `MYSQL_*`.
- Para usar um banco externo/gerenciado (ex.: Coolify), defina `DATABASE_URL` no
  ambiente — ela tem precedência sobre as variáveis do serviço `mysql`.
- Variáveis disponíveis (com defaults): `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`,
  `MYSQL_USER`, `MYSQL_PASSWORD`, `JWT_SECRET` (obrigatória).
- As portas locais (`APP_PORT`, `MYSQL_PORT`) ficam em `docker-compose.override.yml`,
  carregado automaticamente só no ambiente local. Em produção a aplicação apenas
  `expose` a porta 3000 e o proxy da plataforma (Traefik no Coolify) cuida do acesso.

### Conflito com MySQL local (porta 3306)

Por padrão o Compose **não publica** a porta do MySQL no host, então não há conflito
com um MySQL já rodando na 3306 — a aplicação acessa o banco pelo hostname interno
`mysql`. Se precisar da CLI do host contra o MySQL do container, descomente o bloco
`mysql:` no `docker-compose.override.yml` e use uma porta livre (ex.: `MYSQL_HOST_PORT=3307`).

Para, em vez disso, usar o **seu MySQL local** com o app em container, aponte a
`DATABASE_URL` para o host (Linux: use `host.docker.internal` ou o IP do host):

```bash
docker compose up --build -d app \
  -e DATABASE_URL="mysql://root:senha@host.docker.internal:3306/nexus"
```

Na primeira subida é preciso aplicar o schema no banco (a imagem de runtime é enxuta
e não inclui a CLI do Prisma). Faça isso a partir da máquina host:

```bash
# com os serviços no ar (docker compose up -d)
DATABASE_URL="mysql://nexus:nexus_password@localhost:3306/Nexus" \
  npx prisma db push

# opcional: popular com dados de desenvolvimento
DATABASE_URL="mysql://nexus:nexus_password@localhost:3306/Nexus" \
  npm run db:seed
```

> O `.env` é apenas para desenvolvimento local; em Docker/Coolify as variáveis são
> injetadas pelo ambiente e não devem ser comitadas.

## Equipe

Projeto Final — FAETEC Teresópolis, Técnico em Informática 2026.