# Projeto Final FAETEC — Nexus

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | TypeScript + Node (API REST) |
| Frontend | TypeScript + React (Web) |
| Banco | MySQL |
| Monorepo | workspaces: backend/, frontend/, shared/ |

## Estrutura

```
projeto-final-faetec/
├── backend/       # API REST
├── frontend/      # Interface web
├── shared/        # Tipos e funções compartilhadas
│   └── types/     # Interfaces/type aliases das entidades
├── docs/          # Documentação
│   └── puml/      # Diagramas PlantUML
```

## Convenções de Código

- **DB**: snake_case, IDs auto-increment (`ID_entidade`)
- **TypeScript**: camelCase, interfaces em `shared/types/`
- **Permissões**: nomenclatura `entidade.acao` (ex: `produto.criar`). Fixas e pré-definidas. Perfis são templates. Super Admin com flag `super_admin` no usuário.
- **Soft delete**: campo `ativo: Boolean` em toda entidade de cadastro
- **Hard delete proibido**: nada é excluído fisicamente, apenas desativado

## Regras de Negócio Principais

| ID | Regra |
|----|-------|
| RN001 | Bloqueio por falta de estoque |
| RN002 | Alerta de validade no mural para perecíveis |
| RN003 | Pendência automática em entrega parcial |
| RN004 | Imutabilidade de histórico confirmado |

## Modelagem

Diagramas em `docs/puml/`:
- `classes.puml` — Diagrama de classes conceitual
- `DER.puml` — Diagrama Entidade-Relacionamento físico

## Documentos de Referência

- `docs/ENTENDIMENTO.md` — Especificação completa do modelo de dados

## Fluxo Resumido

1. Jonathan transcreve pedidos em papel → **Nota Saída** (reserva estoque)
2. Monta **Remessa** → adiciona na **Rota** do dia (ordem de visita)
3. Sai pra entrega → condutor entrega → **Baixa** (deduz estoque)
4. Se falhar → **Pendente** → pode tentar de novo noutra rota