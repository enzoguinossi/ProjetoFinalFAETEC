# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-19 (movimentação de estoque — KAN-140, branch de trabalho).

## Objetivo atual

**Em andamento: movimentação de estoque (KAN-140)**, na branch
**`KAN-140-mov-estoque`** — 4 commits sobre a `main`, ainda **não integrados**.

Já entregue nessa branch:

1. **Reserva pertence à remessa** — `reserva_estoque` aponta para `id_remessa`; a nota de
   saída não reserva nada.
2. **Aba Entrada** em `/mov-estoque` — nota de entrada com itens, conversão de unidade,
   gravação transacional, auditoria e listagem.
3. **Aba Saída** — nota `SAIDA` sem itens, agregando remessas planejadas, com reserva pela
   `quantidade_solicitada`.
4. **Cancelamento de remessa** — `StatusRemessa.CANCELADA`, libera a reserva, idempotente.
5. **Interface de movimentação** — "Mov. Estoque" virou grupo no menu (Entrada e Saída em
   rotas próprias) e o seletor de entidades virou lista paginada com colunas.

**Entregue antes:** release `1.17.10.2026`; documentação revisada e reorganizada; requisitos
reclassificados.

## Convenções ativas

- Branch de integração: **`main`**. Branches de trabalho: `KAN-<n>-<slug>`
  (a atual é `KAN-140-mov-estoque`). **Não se cria branch por versão** — o release é uma
  **tag na `main`** (`vN.DD.MM.YYYY`). Ver `docs/processo/VERSIONAMENTO.md`.
- Agentes versionados no repositório: `.opencode/agents/*.md`.
- Estado/contratos versionados neste diretório (`.ai-workflow/`).
- Versionamento: **DateVer `N.DD.MM.YYYY`** (fuso `America/Sao_Paulo`) → tag `vN.DD.MM.YYYY`.
- Changelog: **Keep a Changelog 1.1.0 (pt-BR)** em `CHANGELOG.md`.
- Antes de criar/alterar task no Jira: **mostrar o texto exato ao usuário**
  (`docs/processo/JIRA.md`).
- **Índice da documentação:** `docs/README.md`.
- **Fonte de verdade, na ordem:** código → `prisma/schema.prisma` →
  `docs/dominio/{REGRAS_NEGOCIO,REQUISITOS_FUNCIONAIS,REQUISITOS_NAO_FUNCIONAIS,ENTENDIMENTO}.md`
  → `AGENTS.md` → `docs/processo/JIRA.md` → histórico da conversa.
- **Schema:** o projeto **não versiona migrations** — aplica com `prisma db push`.

## Runs

| Run | Objetivo | Agente | Status | Branch/worktree | Issue |
|---|---|---|---|---|---|
| RUN-20261017-01 | Infraestrutura de orquestração multiagente | orchestrator | concluído | `main` | KAN-165 |
| RUN-20261017-02 | Ferramenta de exportação para o Figma | orchestrator | concluído | `figma-export` → `main` | KAN-166 |
| RUN-20261017-03 | Primeiro release (`1.17.10.2026`) | release-manager | concluído | `main` | KAN-165, KAN-166 |
| RUN-20261017-04 | Verificação da doc de domínio vs. schema/código | general | concluído | `main` | — |
| RUN-20261017-05 | Verificação do README, AGENTS e docs de processo | general | concluído | `main` | — |
| RUN-20261017-06 | Reorganização de `docs/` e correções | docs-keeper | concluído | `main` | — |
| RUN-20261017-07 | Referências à documentação fora de `docs/` | developer | concluído | `main` | — |
| RUN-20261017-08 | `mensagem_mural.ID_usuario` nullable; coluna órfã removida | developer | concluído | `main` | — |
| RUN-20261017-09 | RN003 e `tipo_codigo` registrados | docs-keeper | concluído | `main` | — |
| RUN-20261017-10 | Nota de saída sem destinatário; build reparado | developer | concluído | `main` | — |
| RUN-20261017-11 | Nota consolida pedidos (FK em `pedido_escola`) | developer | concluído | `main` | — |
| RUN-20261019-12 | Reclassificação de requisitos e escopo fora | docs-keeper | concluído | `main` | — |
| RUN-20261019-13 | Reserva de estoque passa a pertencer à remessa | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-14 | Aba Entrada da movimentação | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-15 | Aba Saída com remessas planejadas | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-16 | `StatusRemessa.CANCELADA` e cancelamento | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-17 | "Mov. Estoque" vira grupo no menu; rotas de Entrada e Saída | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-18 | Seletor de entidades vira lista paginada com colunas | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-19 | Experimento de migração para shadcn/ui | developer | concluído (experimento) | `experimento-shadcn` (worktree) | KAN-140 |
| RUN-20261020-20 | Tabela semântica própria (alinhamento), sem dependência | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-21 | `Modal` sobre Radix Dialog (foco, aria, portal) | developer | concluído (agente caiu; validado pelo Orquestrador) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-22 | Rodapé do `DataTable` com contagem e paginação | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |

Os runs 04–12 não têm issue: **decisão explícita do usuário** de commitar sem chave. É uma
**exceção consciente** à regra 1 de smart commits do `AGENTS.md`.

## Bloqueios e dependências

- Nenhum bloqueio.
- **Pendências de decisão** (não bloqueiam o que está feito):
  1. **Quando a nota de saída passa a `CANCELADA`** — com uma remessa cancelada ou só
     quando todas estiverem. Não decidir sem o usuário.
  2. **`KAN-140` no Jira** descreve escopo maior (inclui inventário e alertas de validade) e
     ainda marca o RF016 como "Importante" (hoje Essencial). Reescrita e divisão em
     subtasks precisam de aprovação do texto exato.
  3. **Spike do portal do Radix** — o `Modal` usa portal desde `b8a79c0`, mas o
     `figma:harvest` das 47 telas **não rodou**. O `figma:check` valida invariantes contra
     cenas já colhidas; só a colheita nova prova que o portal não altera a estrutura
     capturada. Até lá, o Radix está apoiado em verificação parcial.
  4. **Branch `experimento-shadcn`** — 5 commits, sem push, parada como referência. Nada
     dela foi integrado. Apagar a worktree exige autorização do usuário.

- **Risco conhecido do ambiente de testes:** a suíte usa **um banco único** (`nexus_test`)
  sem trava. Duas execuções simultâneas de `npm test` corrompem uma à outra e o sintoma é
  violação de chave estrangeira — que parece defeito de código e não é (aconteceu em
  2026-10-20 e foi diagnosticado rodando um arquivo isolado).

## Trabalho existente a preservar

- Worktree **`gravacao`**: `prisma/seed-demo.ts` não rastreado. Preservar.
- Worktree **`modulo-estoque`** (branch `KAN-140-modulo-estoque`): **descartada**. Não
  deletar branch nem worktree sem autorização — a implementação nova está em
  `KAN-140-mov-estoque`.

## Decisões de modelagem de 2026-10-19

| # | Decisão | Efeito no modelo |
|---|---|---|
| 1 | Mensagens automáticas do mural não têm autor | `mensagem_mural.ID_usuario` → opcional |
| 2 | RN003: a pendência é a remessa `PENDENTE` do split | **sem** tabela nova |
| 3 | `anexo.ID_documento_fiscal` era coluna órfã | coluna **removida** |
| 4 | `tipo_codigo` sem permissões é intencional | dado de referência, sem CRUD |
| 5 | A nota de saída **não tem destinatário** | `nota_saida.ID_destinatario` removida |
| 6 | A nota **consolida pedidos** | FK em `pedido_escola.ID_nota_saida` (1:N) |
| 7 | **A reserva pertence à remessa** | `reserva_estoque.id_remessa`; a nota não reserva |
| 8 | `SAIDA` não tem itens | itens e destinatário ficam na remessa; `CONSUMO_INTERNO`/`AVARIA`/`DESMONTAGEM` mantêm itens |
| 9 | Reserva pela `quantidade_solicitada` | no ato da criação da remessa |
| 10 | Cancelamento de remessa | `StatusRemessa.CANCELADA`, libera a reserva |

## Reclassificação de requisitos (2026-10-19)

`RF009`, `RF013`, `RF016`, `RF024`, `RNF002` e **`RF022`** são **Essenciais**.
**Fora do escopo:** `RF018` (Kanban), `RF025` e `RNF009` (NF-e XML) — ver
`docs/dominio/ESCOPO_FORA.md`.

## Base de dados de desenvolvimento

- O usuário **resetou o banco `nexus`** em 2026-10-19 para testar a tela. O estado atual é
  limpo e de teste: 4 produtos, 3 linhas de estoque, 1 nota de entrada com 3 itens, nenhuma
  nota de saída. **Não é perda a investigar** — foi ação consciente do usuário.
- Banco e schema em sincronia (`prisma migrate diff` → *No difference detected*).

## Git (verificado no checkpoint)

- Branch atual: **`KAN-140-mov-estoque`** — 11 commits sobre a `main`:
  `628d55e` (reserva na remessa), `0818cef` (entrada), `81fef26` (saída), `24c11fb`
  (cancelamento), `1e011d3` (estado), `56bc3aa` (menu), `42af591` (seletor paginado),
  `9f391c5` (estado), `f9c24cf` (tabela semântica), `b8a79c0` (Modal com Radix) e
  `ff90c6c` (rodapé do DataTable).
- `main` = `1097e0f`; `origin/main` = `6922050`. A branch está **18 commits à frente** de
  `origin/main` — nada publicado desde a release.
- Tag `v1.17.10.2026` é a única do projeto. Árvore limpa.

## Último checkpoint válido

- 2026-10-19 — movimentação de estoque: entrada, saída e cancelamento implementados na
  branch `KAN-140-mov-estoque`, com banco aplicado e sincronizado.
- Documentação anterior consolidada: `docs/` em `dominio/` · `processo/` · `diagramas/`;
  25 divergências de domínio e 13 de processo corrigidas; `README.md` enxuto; requisitos
  reclassificados e escopo fora documentado.
- Entradas **publicadas** do `CHANGELOG` permanecem intactas (não se reescreve histórico).

## Testes executados

- `npm test` → **191/191 (21 arquivos)** · `npm run build` → *Compiled successfully* —
  reexecutados pelo Orquestrador no `24c11fb`.
- `npx prisma validate` + `prisma generate` + `prisma db push` → OK; `migrate diff` →
  *No difference detected*.
- `node scripts/ai-workflow-check.mjs` → 13/13 automáticos, 0 falhas (última execução).
- `npm run figma:check` — da release anterior.

## Próximas ações

1. **Decidir quando a nota vira `CANCELADA`** (uma remessa ou todas) — pendência registrada.
2. **Continuar a KAN-140:** entrega/baixa da remessa (finalização), que consome a reserva e
   dá a baixa física; depois rotas e percursos (RF022, agora Essencial).
3. **Integrar a branch na `main`** e publicar — requer aprovação do usuário.
4. **Reescrever a `KAN-140` no Jira** (escopo e divisão em subtasks), com o texto exato
   aprovado antes de qualquer alteração.
5. Definir o destino de `gravacao` (worktree com `prisma/seed-demo.ts` não rastreado).
