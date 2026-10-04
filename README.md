# Projeto Final FAETEC — Nexus

Sistema de Controle de Estoque e Logística de Remessas para galpão logístico — distribuição de materiais para 105+ escolas municipais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Stack** | Next.js 14+ (App Router) — Full Stack |
| **ORM** | Prisma 7 |
| **Banco** | MySQL |
| **Autenticação** | Feita na mão (bcrypt + JWT via `jose`, HS256) |
| **Imagens** | `sharp` — conversão para WEBP no upload |
| **CEP** | `cep-promise` — busca de endereço |
| **Versionamento** | GitHub |

## Dependências e utilitários relevantes

| Recurso | Onde | Descrição |
|---------|------|-----------|
| `sharp` | `src/lib/imagem.ts` | Valida (JPG/PNG/WEBP, ≤ 5 MB), redimensiona (máx. 1024px) e converte para WEBP (qualidade 80). Grava em `public/uploads/produtos/{id}/{timestamp}-{hash}.webp`. |
| `cep-promise` | `src/services/cep.ts` | Preenche logradouro/bairro/cidade/UF a partir do CEP (providers brasilapi/viacep/widenet). |
| Códigos personalizados | `src/lib/codigo.ts` + `CodigosSection` | Tipos por entidade (EAN12/13, COD_FORNECEDOR, COD_ESCOLA, MATRICULA, DIGITACAO). |
| Permissões | `src/services/permissao.ts` + `PermissoesPanel` | Perfis-template, aplicar perfil e edição individual de permissões. |
| Unidades de conversão | `src/components/UnidadesModal.tsx` | CRUD no modal do cadastro de produto (sem desativação). |

## Uploads

As imagens enviadas são convertidas para **WEBP** e salvas em `public/uploads/` (fora do versionamento — ver `.gitignore`). O processamento ocorre durante o salvamento do cadastro: se a imagem falhar, o registro não é persistido.

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

# Preparar o ambiente (generate + push + seed de referência)
npm run setup          # ou: npm run db:setup

# Iniciar dev
npm run dev
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | Lint do projeto |
| `npm run setup` | `npm install` + preparação do banco |
| `npm run db:setup` | `prisma generate` + `prisma db push` + seed |
| `npm run db:reset` | **Apaga todos os dados** (`--force-reset`) e re-seeda |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:seed` | Executa o seed de referência |
| `npm run db:studio` | Abre o Prisma Studio |

### Seed

O seed popula apenas os dados fixos de referência: **tipos de código, permissões, perfis-template (Operador/Auxiliar) e unidades de conversão**. Nenhum cadastro (usuários, funcionários, produtos, destinatários, fornecedores, veículos) é criado — o Super Admin é criado pelo fluxo de primeiro acesso do próprio sistema.

## Equipe

Projeto Final — FAETEC Teresópolis, Técnico em Informática 2026.