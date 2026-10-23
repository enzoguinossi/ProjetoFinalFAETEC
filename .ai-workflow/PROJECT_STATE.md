# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-22 (sincronização de estado e Jira — KAN-140, branch de trabalho).

## Objetivo atual

**Em andamento: movimentação de estoque (KAN-140)**, na branch
**`KAN-140-mov-estoque`** — **21 commits** sobre a `main`, ainda **não integrados**.

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
| RUN-20261020-23 | Entrada: chave única, botões de lupa e fornecedor inline | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-24 | Linha expansível na listagem de saídas | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-25 | Chave de acesso vira coluna nullable na nota de entrada | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-26 | Botões de campo (lupa e "+") no padrão do sistema | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-27 | Permissões `remessa.consultar` e `remessa.alterar` | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-28 | Nota de entrada: visualizar e editar com correção de estoque | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-29 | Remessa e nota de saída: visualizar e editar com ajuste de reserva | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261021-30 | Coluna "Código" na expansão da nota de saída | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261022-31 | Sincronização de estado + status no Jira | orchestrator | concluído | `KAN-140-mov-estoque` | KAN-137, KAN-140, KAN-146, KAN-147, KAN-164 |
| RUN-20261023-31 | Expedições: status da rota e permissões de rota/percurso | developer | concluído (sem commit) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-32 | Expedições: CRUD de percursos | developer | **em andamento** | `KAN-140-mov-estoque` | KAN-140 |

Os runs 04–12 não têm issue: **decisão explícita do usuário** de commitar sem chave. É uma
**exceção consciente** à regra 1 de smart commits do `AGENTS.md`.

## Bloqueios e dependências

- Nenhum bloqueio.
- **Pendências de decisão** (não bloqueiam o que está feito):
  1. **Quando a nota de saída passa a `CANCELADA`** — com uma remessa cancelada ou só
     quando todas estiverem. Não decidir sem o usuário.
  2. **`KAN-140` no Jira** descreve escopo maior (inclui inventário e alertas de validade) e
     ainda marca o RF016 como "Importante" (hoje Essencial). Reescrita e divisão em
     subtasks precisam de aprovação do texto exato. O status está **Em andamento** desde
     2026-10-22 (confirmado em 2026-10-23).
  3. **Worklog de KAN-140** — lançado **8h** em 2026-10-22 (`#10124`, iniciado em 19/10
     22:15). Mas já existia um worklog de **4h** (`#10123`, iniciado em 22/10 08:57, sem
     comentário), que não aparecia na primeira leitura da issue. Total atual: **12h**.
     Falta o usuário decidir se o total deve ser 8h (editar o `#10124` para 4h) ou 12h.
  4. **Spike do portal do Radix** — o `Modal` usa portal desde `b8a79c0`, mas o
     `figma:harvest` das 47 telas **não rodou**. O `figma:check` valida invariantes contra
     cenas já colhidas; só a colheita nova prova que o portal não altera a estrutura
     capturada. Até lá, o Radix está apoiado em verificação parcial.
  5. **Branch `experimento-shadcn`** — 5 commits, sem push, parada como referência. Nada
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

- Branch atual: **`KAN-140-mov-estoque`** — **21 commits** sobre a `main` (`main` = `1097e0f`).
  Marcos recentes: `628d55e` (reserva na remessa), `0818cef` (entrada), `81fef26` (saída),
  `24c11fb` (cancelamento), `56bc3aa` (menu), `42af591` (seletor paginado), `f9c24cf`
  (tabela semântica), `b8a79c0` (Modal com Radix), `ff90c6c` (rodapé), `32ab8fa` (chave única),
  `6637741` (chave nullable), `f1f3f09` (botões), `fca9932` (linha expansível),
  `5e42d92` (permissões de remessa), `977dcd3` (entrada view/edit), `26e4c74`
  (saída e remessa view/edit) e `61ccc48` (coluna Código na expansão).
- `origin/main` = `6922050`. A branch está **28 commits à frente** de `origin/main`; a `main`
  local está **7 commits à frente** de `origin/main` (docs + `e407b96`) — nada publicado desde
  a release.
- Tag `v1.17.10.2026` é a única do projeto. Árvore limpa (nenhum arquivo modificado ou não
  rastreado neste checkout).

## Último checkpoint válido

- 2026-10-23 — status do Jira reconferido (KAN-137 e KAN-146 **Concluído**; KAN-140, KAN-147 e
  KAN-164 **Em andamento**) e worklog de **8h** lançado na KAN-140 (`#10124`). No checkout há
  trabalho novo de expedições ainda **não commitado**: `RUN-20261023-31` concluído (status da
  rota + permissões) e `RUN-20261023-32` em andamento (CRUD de percursos).
- 2026-10-22 — estado reconferido no Git e no Jira: branch com 21 commits, árvore limpa,
  `npm run test:coverage` verde (222 testes; cobertura global 90,22% de statements, services
  90,4%).
- 2026-10-21 — coluna "Código" na expansão da nota de saída (`61ccc48`).
- 2026-10-19 — movimentação de estoque: entrada, saída e cancelamento implementados na
  branch `KAN-140-mov-estoque`, com banco aplicado e sincronizado.
- Documentação anterior consolidada: `docs/` em `dominio/` · `processo/` · `diagramas/`;
  25 divergências de domínio e 13 de processo corrigidas; `README.md` enxuto; requisitos
  reclassificados e escopo fora documentado.
- Entradas **publicadas** do `CHANGELOG` permanecem intactas (não se reescreve histórico).

## Jira em 2026-10-22

| Issue | Antes | Depois | Base da decisão |
| --- | --- | --- | --- |
| KAN-137 — Autenticação e Usuários | Em andamento | **Concluído** | RF001/RF002/RNF004 no código (`src/app/usuarios`, `src/app/perfis`, `src/services/permissao.ts`, `src/proxy.ts`); inativação e `ultimo_acesso` presentes |
| KAN-146 — Testes unitários | A fazer | **Concluído** | `npm run test:coverage`: 222 testes em 25 arquivos; services 90,4% de statements (meta ≥70%); CI em `.github/workflows/tests.yml` |
| KAN-147 — Testes de integração | A fazer | **Em andamento** | testes de serviço com banco real (`tests/services/nota-entrada`, `nota-saida`, `remessa-*`); fluxos de entrega/baixa ainda não existem |
| KAN-164 — Refatoração e otimização | A fazer | **Em andamento** | paginação server-side nos 6 módulos + rodapé do `DataTable` entregues; debounce, N+1 e consolidação pendentes |
| KAN-140 — Módulo de Estoque | A fazer | **Em andamento** (confirmado em 23/10) | RF012/**RF017a**/**RF017b** entregues na branch; RF014 (validade), RF015 (inventário) e RF016 (baixas) sem código |

Comentários nas issues: **nenhum publicado** — `docs/processo/JIRA.md` exige aprovação prévia
do texto. **Worklog:** 8h lançadas na KAN-140 em 2026-10-22 (`#10124`); existe também um
lançamento anterior de **4h** (`#10123`), então o total está em **12h** até o usuário decidir
entre 8h (editar `#10124` para 4h) e 12h.

## Testes executados

- `npm run test:coverage` (2026-10-22, Orquestrador) → **222/222 (25 arquivos)**; cobertura
  global 90,22% statements · 84,55% branches · 90,94% funções · 92,28% linhas; `services`
  90,4% statements · `dao` 94,33%.
- Última execução de `npm test` + `npm run build` + `npm run figma:check` antes do commit
  `61ccc48`: 222/222, build *Compiled successfully*, plugin verificado sem problemas
  (`RUN-20261021-30`).
- `npx prisma validate` + `prisma generate` + `prisma db push` → OK; `migrate diff` →
  *No difference detected*.
- `node scripts/ai-workflow-check.mjs` → 13/13 automáticos, 0 falhas (última execução).

## Próximas ações

1. **Fechar o worklog da KAN-140** — decidir entre 8h e 12h de total (ver pendência 3).
2. **Concluir o `RUN-20261023-32`** (CRUD de percursos) e commitar o `RUN-20261023-31`, que
   está pronto mas sem commit no checkout.
3. **Continuar a KAN-140:** entrega/baixa da remessa (finalização), que consome a reserva e
   dá a baixa física; depois baixas (RF016), inventário (RF015), validade (RF014) e rotas
   e percursos (RF022, agora Essencial).
4. **Integrar a branch na `main`** e publicar — requer aprovação do usuário.
5. **Reescrever a `KAN-140` no Jira** (escopo e divisão em subtasks), com o texto exato
   aprovado antes de qualquer alteração.
6. Definir o destino de `gravacao` (worktree com `prisma/seed-demo.ts` não rastreado) e da
   `experimento-shadcn`.
