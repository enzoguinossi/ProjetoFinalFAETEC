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
| `dominio/` | [`REQUISITOS_FUNCIONAIS.md`](dominio/REQUISITOS_FUNCIONAIS.md) | os 25 requisitos funcionais (especificação) |
| `dominio/` | [`REQUISITOS_NAO_FUNCIONAIS.md`](dominio/REQUISITOS_NAO_FUNCIONAIS.md) | os 9 requisitos não funcionais |
| `processo/` | [`VERSIONAMENTO.md`](processo/VERSIONAMENTO.md) | versionamento DateVer e o padrão do changelog |
| `processo/` | [`JIRA.md`](processo/JIRA.md) | Jira: issues, smart commits e worklog |
| `processo/` | [`WORKFLOW.md`](processo/WORKFLOW.md) | fluxo multiagente, worktrees e rastreabilidade |
| `diagramas/` | [`classes.puml`](diagramas/classes.puml) | diagrama de classes conceitual (52 classes) |
| `diagramas/` | [`DER.puml`](diagramas/DER.puml) | diagrama entidade-relacionamento (52 entidades) |
| `diagramas/` | [`fluxo_atual.puml`](diagramas/fluxo_atual.puml) e [`fluxosAtuais/`](diagramas/fluxosAtuais/) | o fluxo **AS-IS manual** (papel, Trello, Excel) — **não** é o fluxo alvo do sistema |

As convenções de desenvolvimento (arquitetura, regras críticas e o que nunca fazer) estão em
[`../AGENTS.md`](../AGENTS.md); o histórico de mudanças, em [`../CHANGELOG.md`](../CHANGELOG.md).
