# Projeto Final FAETEC — Nexus

Sistema web de controle de estoque e logística de remessas de um galpão logístico que
distribui materiais de higiene, limpeza, papelaria e didáticos para 105+ escolas e creches
municipais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Aplicação** | Next.js 16 (App Router) — Full Stack |
| **Linguagem** | TypeScript |
| **ORM** | Prisma 7 |
| **Banco** | MySQL/MariaDB (driver `@prisma/adapter-mariadb`) |
| **Autenticação** | Própria — BCrypt + JWT HS256 (`jose`) |
| **UI** | Tailwind CSS v4 |
| **Testes** | Vitest |

## Como rodar

```bash
npm install
cp .env.example .env   # editar as credenciais do banco
npm run setup          # generate + db push + seed de referência
npm run dev
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | Lint do projeto |
| `npm test` | Testes (Vitest) |
| `npm run setup` | `npm install` + preparação do banco |
| `npm run db:setup` | `prisma generate` + `prisma db push` + seed |
| `npm run db:generate` | Gera o cliente Prisma |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:seed` | Executa o seed de referência |
| `npm run db:reset` | **Apaga todos os dados** (`--force-reset`) e re-seeda |
| `npm run db:studio` | Abre o Prisma Studio |

O seed popula apenas dados de referência (tipos de código, permissões, perfis-template e
unidades de conversão); nenhum cadastro é criado — o Super Admin nasce no fluxo de primeiro
acesso do sistema.

## Documentação

Toda a documentação está indexada em **[`docs/README.md`](docs/README.md)** — modelo de
dados, regras de negócio, requisitos, diagramas e convenções de processo.

> Uploads: as fotos de produto são convertidas para WEBP e gravadas em `public/uploads/`
> (fora do versionamento — ver `.gitignore`).

## Equipe

Projeto Final — FAETEC Teresópolis, Técnico em Informática 2026.
