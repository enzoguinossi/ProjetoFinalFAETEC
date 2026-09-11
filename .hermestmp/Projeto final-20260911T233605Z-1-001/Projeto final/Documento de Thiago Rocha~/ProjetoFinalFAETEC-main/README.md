# Projeto Final FAETEC — Nexus

Sistema de Controle de Estoque e Logística de Remessas para o galpão da Secretaria Municipal de Educação (SME) de Teresópolis.

## Stack

- **Backend:** TypeScript + Node (API REST)
- **Frontend:** TypeScript + React (Web)
- **Banco:** MySQL
- **Monorepo:** workspaces (`backend/`, `frontend/`, `shared/`)

## Estrutura

```
projeto-final-faetec/
├── backend/          # API REST
├── frontend/         # Interface web
├── shared/           # Tipos e funções compartilhadas
├── docs/             # Documentação e diagramas
│   └── puml/         # Diagramas PlantUML
├── AGENTS.md         # Convenções do projeto
└── package.json
```

## Documentação

- [`docs/ENTENDIMENTO.md`](docs/ENTENDIMENTO.md) — Especificação completa do modelo de dados
- [`docs/puml/classes.puml`](docs/puml/classes.puml) — Diagrama de classes conceitual
- [`docs/puml/DER.puml`](docs/puml/DER.puml) — Diagrama Entidade-Relacionamento físico