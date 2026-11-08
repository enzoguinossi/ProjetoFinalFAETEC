# Documentação — Nexus

Índice da documentação do **Nexus**, o sistema de controle de estoque e logística de
remessas do galpão que atende 105+ escolas e creches municipais.

## Fonte de verdade

O **código e a configuração atuais** vêm primeiro; o **modelo físico** é
[`../prisma/schema.prisma`](../prisma/schema.prisma). Os documentos abaixo descrevem o
domínio, a especificação e o processo — quando um deles divergir do código, o código vence
(ver [`../AGENTS.md`](../AGENTS.md) §2).

## Onde está cada coisa

| Pasta | Documento | Para quê |
| --- | --- | --- |
| `dominio/` | [`ENTENDIMENTO.md`](dominio/ENTENDIMENTO.md) | modelo de dados detalhado: tabelas, colunas, relações, enums e os fluxos de estoque, notas, remessas e inventário |
| `dominio/` | [`IMPLEMENTACAO.md`](dominio/IMPLEMENTACAO.md) | **o que já existe no código**, requisito a requisito (estado atual) |
| `dominio/` | [`REGRAS_NEGOCIO.md`](dominio/REGRAS_NEGOCIO.md) | as 5 regras de negócio (RN001–RN005) |
| `dominio/` | [`REQUISITOS_FUNCIONAIS.md`](dominio/REQUISITOS_FUNCIONAIS.md) | os 26 requisitos funcionais (especificação) |
| `dominio/` | [`REQUISITOS_NAO_FUNCIONAIS.md`](dominio/REQUISITOS_NAO_FUNCIONAIS.md) | os 9 requisitos não funcionais |
| `dominio/` | [`ESCOPO_FORA.md`](dominio/ESCOPO_FORA.md) | os requisitos que **não serão implementados** (`RF026` e `RNF009`), com o critério de exclusão |
| `processo/` | [`VERSIONAMENTO.md`](processo/VERSIONAMENTO.md) | versionamento DateVer e o padrão do changelog |
| `processo/` | [`JIRA.md`](processo/JIRA.md) | Jira: issues, smart commits e worklog |
| `processo/` | [`WORKFLOW.md`](processo/WORKFLOW.md) | fluxo multiagente, worktrees e rastreabilidade |
| `processo/` | [`PRODUCAO.md`](processo/PRODUCAO.md) | runbook do servidor Windows: instalação, atualização, backup, bandeja e desinstalação |
| `diagramas/` | [`classes.puml`](diagramas/classes.puml) | diagrama de classes conceitual (48 classes) |
| `diagramas/` | [`DER.puml`](diagramas/DER.puml) | diagrama entidade-relacionamento (48 entidades) |
| `diagramas/` | [`fluxo_atual.puml`](diagramas/fluxo_atual.puml) e [`fluxosAtuais/`](diagramas/fluxosAtuais/) | o fluxo **AS-IS manual** (papel, Trello, Excel) — **não** é o fluxo alvo do sistema |
| `relatorios/` | [`relatorios/README.md`](relatorios/README.md) | modelo A4 dos relatórios impressos e componentes de filtro compartilhados |

Os componentes de UI compartilhados ficam em `src/components/`. A barra de filtros em chips
(`BarraFiltrosBase`, controlada) atende tanto os relatórios — via o wrapper de URL
`BarraFiltros` — quanto as listagens do sistema; os chips são adicionáveis/removíveis e não
há filtro fixo nas telas (só os checkboxes de apresentação dos relatórios).

As convenções de desenvolvimento (arquitetura, regras críticas e o que nunca fazer) estão em
[`../AGENTS.md`](../AGENTS.md); o histórico de mudanças, em [`../CHANGELOG.md`](../CHANGELOG.md).
