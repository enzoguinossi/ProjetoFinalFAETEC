# Projeto Final FAETEC — Nexus

Sistema de Controle de Estoque e Logística de Remessas para galpão logístico — distribuição de materiais para 105+ escolas municipais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Stack** | Next.js 14+ (App Router) — Full Stack |
| **ORM** | Prisma 7 |
| **Banco** | MySQL |
| **Autenticação** | Feita na mão (bcrypt + JWT) |
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

## Equipe

Projeto Final — FAETEC Teresópolis, Técnico em Informática 2026.