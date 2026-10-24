# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-23 (fusão nota/remessa, expedições e execução da entrega).

## Objetivo atual

**Em andamento: movimentação de estoque (KAN-140)**, na branch
**`KAN-140-mov-estoque`** — **36 commits** sobre a `main` local (`1097e0f`) e **43** sobre
`origin/main` (`6922050`), medidos em `fbb2146`; **nada integrado nem publicado**.

Entregue nesta branch:

1. **Movimentação** — abas Entrada e Saída em `/mov-estoque`, com reserva, edição por
   delta, cancelamento idempotente e auditoria.
2. **Percursos** — CRUD completo com destinatários ordenados e exclusão física
   (`dec190f`, `5333c07`).
3. **Rota virou Expedição** — no produto e no modelo (`expedicao`, `expedicao_nota`,
   `StatusExpedicao`); `EM_ROTA` do veículo virou `EM_EXPEDICAO` (`9d53194`).
4. **Fusão nota = entrega** — `remessa`, `item_remessa` e `StatusRemessa` deixaram de
   existir; a nota tem destinatário, itens, reserva e status de entrega; a expedição é o
   manifesto com veículo e condutor (`85fceac`).
5. **Módulo de Expedições** — lista, detalhe, criação com percurso (consumido, não
   gravado), ordem por setas, adicionar/remover notas e despacho (`e119c4d`).
6. **Execução da entrega** — entregue (baixa), parcial (restante reservado), corte
   (libera restante), não entregue e conclusão da expedição (`89c2f52`).
7. **Tipo de Saída** — Remessa (reserva), Avaria e Consumo Interno (baixa real na
   criação, sem destinatário e sem reserva), com itens inline sem campos de valor
   (`9f12115`).
8. **Unidade padrão do sistema** — `UNIDADE` (fator 1) é única padrão e não excluível;
   todo produto tem unidade obrigatória; excluir outra unidade revincula os produtos à
   padrão (`fbb2146`).

**Entregue antes:** release `1.17.10.2026`; documentação revisada e reorganizada;
requisitos reclassificados.

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
| RUN-20261017-08 | `mensagem_mural.ID_usuario` nullable; coluna órfã | developer | concluído | `main` | — |
| RUN-20261017-09 | RN003 e `tipo_codigo` registrados | docs-keeper | concluído | `main` | — |
| RUN-20261017-10 | Nota de saída sem destinatário; build reparado | developer | concluído | `main` | — |
| RUN-20261017-11 | Nota consolida pedidos (FK em `pedido_escola`) | developer | concluído | `main` | — |
| RUN-20261019-12 | Reclassificação de requisitos e escopo fora | docs-keeper | concluído | `main` | — |
| RUN-20261019-13 | Reserva de estoque passa a pertencer à remessa | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-14 | Aba Entrada da movimentação | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-15 | Aba Saída com remessas planejadas | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261019-16 | `StatusRemessa.CANCELADA` e cancelamento | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-17 | "Mov. Estoque" vira grupo no menu | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-18 | Seletor de entidades vira lista paginada | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-19 | Experimento de migração para shadcn/ui | developer | concluído (experimento) | `experimento-shadcn` | KAN-140 |
| RUN-20261020-20 | Tabela semântica própria | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-21 | `Modal` sobre Radix Dialog | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-22 | Rodapé do `DataTable` | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-23 | Entrada: chave única e fornecedor inline | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-24 | Linha expansível na listagem de saídas | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-25 | Chave de acesso como coluna nullable | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-26 | Botões de campo (lupa e "+") | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-27 | Permissões de remessa (removidas no run 35) | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-28 | Nota de entrada: visualizar e editar | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261020-29 | Saída e remessa: visualizar e editar | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261021-30 | Coluna "Código" na expansão | developer | concluído | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261022-31 | Sincronização de estado + Jira | orchestrator | concluído | `KAN-140-mov-estoque` | KAN-137/140/146/147/164 |
| RUN-20261023-31 | Expedições: `StatusExpedicao` e permissões | developer | concluído (`1eec963`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-32 | CRUD de percursos | developer | concluído (`dec190f`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-33 | Percurso com exclusão física; rota sem percurso | developer | concluído (`5333c07`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-34 | Rota vira expedição no modelo, código e permissões | developer | concluído (`9d53194`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-35 | Fusão nota = entrega; remessa deixa de existir | developer | concluído (`85fceac`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-36 | Módulo de expedições | developer | concluído (`e119c4d`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261023-37 | Execução da entrega, baixa e conclusão | developer | concluído (`89c2f52`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261024-38 | Tipo de saída (Remessa/Avaria/Consumo) e itens sem valores | developer | concluído (`9f12115`) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261024-39 | Unidade padrão do sistema e conversão obrigatória | developer | concluído (`fbb2146`, junto do 40) | `KAN-140-mov-estoque` | KAN-140 |
| RUN-20261024-40 | Unidade sem sigla e exclusão com revínculo à padrão | developer | concluído (`fbb2146`) | `KAN-140-mov-estoque` | KAN-140 |

Os runs 04–12 não têm issue: **decisão explícita do usuário** de commitar sem chave. É uma
**exceção consciente** à regra 1 de smart commits do `AGENTS.md`.

## Modelo atual (2026-10-23)

```text
nota_saida (destinatário, urgência, status de entrega)
  └── item_nota_saida (qtd_esperada, qtd_entregue)
  └── reserva_estoque (por nota, na criação)

expedicao (veículo, condutor, data prevista, PLANEJADA/EM_PERCURSO/CONCLUIDA)
  └── expedicao_nota (ordem_visita)  → nota_saida
```

- Não existem mais `remessa`, `item_remessa` nem `StatusRemessa`.
- `StatusNotaSaida`: `ABERTA`, `EM_PERCURSO`, `PENDENTE`, `BAIXA_TOTAL`, `BAIXA_PARCIAL`,
  `BAIXA_COM_CORTE`, `CANCELADA`.
- `percurso`/`percurso_destinatario` continuam como template, **sem** `ativo` (exclusão
  física) e **não** são gravados na expedição.
- `conversao_unidade`: `UNIDADE` (fator 1) é a única `padrao`, não excluível e com
  nome/fator travados. Excluir outra unidade revincula os produtos à padrão. Todo produto
  tem `id_conversao_padrao` **obrigatório**. Não existe `sigla`.

## Decisões de 2026-10-23 (substituem parte das de 19/10)

| # | Decisão | Efeito |
|---|---|---|
| 1 | **Nota = entrega** | destinatário, itens, reserva e status na nota; remessa extinta |
| 2 | **Reserva na criação da nota** | `reserva_estoque.ID_nota_saida` |
| 3 | **Expedição = manifesto** | veículo e condutor na expedição |
| 4 | **Parcial sem split** | a pendência é a mesma nota em `BAIXA_PARCIAL`, restante reservado |
| 5 | **Corte libera o restante** | `BAIXA_COM_CORTE`, sem movimentação de estoque |
| 6 | **Finalização dá baixa** | `quantidade_atual -= entregue` e `saldo_reservado -= entregue` |
| 7 | **Permissões** | `remessa.*` removidas; `nota_saida.*` com 6; total **77** |

**Superadas (19/10):** reserva na remessa (7), saída sem itens (8) e reserva pela
`quantidade_solicitada` na remessa (9). A FK `pedido_escola.ID_nota_saida` permanece, mas
os pedidos vinculados precisam ser do destinatário da nota.

## Bloqueios e pendências

- **Nenhum bloqueio.**
- **Pendências de decisão:**
  1. **Correção de baixa já registrada** — hoje é histórico; um estorno exige ajuste
     próprio. Não decidir sem o usuário.
  2. **`figma:harvest`** — as telas de expedição são novas e a colheita ainda não rodou;
     o `figma:check` valida invariantes contra as cenas antigas (47).
  3. **KAN-140 no Jira** — o texto descreve escopo maior e precisa de reescrita/subtasks
     com aprovação prévia do texto exato.
  4. **Worklog de KAN-140** — 8h (`#10124`) + 4h (`#10123`); decidir entre 8h e 12h.
  5. **Branch `experimento-shadcn`** — parada como referência; apagar exige autorização.

- **Risco do ambiente de testes:** a suíte usa um banco único (`nexus_test`) sem trava.
  Duas execuções simultâneas corrompem uma à outra (sintoma: violação de FK falsa).

## Base de dados de desenvolvimento

- Banco `nexus` **recriado** em 2026-10-23 (`db push --force-reset` + seed), autorizado
  pelo usuário. Estado atual: **0 produtos, 0 estoques, 0 notas, 0 expedições** — só as
  permissões e os dados de referência do seed.
- O `nexus_test` foi sincronizado com o mesmo schema.

## Git (verificado em 2026-10-23)

- Branch **`KAN-140-mov-estoque`**: **30 commits** sobre a `main` local (`1097e0f`) e
  **37** sobre `origin/main` (`6922050`). Árvore limpa.
- Marcos recentes: `1eec963` (status/permissões), `dec190f` (percursos), `5333c07`
  (percurso físico), `9d53194` (rename), `85fceac` (fusão), `e119c4d` (expedições),
  `89c2f52` (execução/baixa).
- Tag `v1.17.10.2026` é a única do projeto. **Nada publicado desde a release.**

## Último checkpoint válido

- **2026-10-24** — **unidade padrão** (`fbb2146`): `UNIDADE` (fator 1) é a única `padrao`,
  não excluível, com nome/fator travados; `produto.ID_conversao_padrao` é **NOT NULL** e
  recebe a padrão automaticamente; excluir outra unidade revincula os produtos à padrão.
  Sem `sigla`. **263 testes**, lint, build e `figma:check` verdes.
- **2026-10-24** — **Tipo de Saída** (`9f12115`): Remessa reserva; Avaria e Consumo Interno
  não têm destinatário, não reservam e baixam o estoque na criação; itens inline sem
  valores. **254 testes**, lint, build e `figma:check` verdes.
- **2026-10-23** — fusão **nota = entrega** (`85fceac`), módulo de **expedições**
  (`e119c4d`) e **execução da entrega com baixa** (`89c2f52`); estado consolidado em
  `c860277`. Árvore limpa, **246 testes**, lint, build e `figma:check` verdes. Banco de
  dev recriado e vazio (só seed).
- **2026-10-23** — rename rota → expedição (`9d53194`) e percurso com exclusão física
  (`5333c07`); 232 testes.
- **2026-10-22** — sincronização com o Jira: KAN-137 e KAN-146 concluídos; worklog de 8h
  na KAN-140.
- **2026-10-21** — coluna "Código" na expansão da nota de saída (`61ccc48`).
- **2026-10-19** — movimentação de estoque: entrada, saída e cancelamento implementados.

## Testes executados (2026-10-24, Orquestrador)

- `npm test` → **263/263 (25 arquivos)**.
- `npm run lint` → exit 0 · `npm run build` → *Compiled successfully* (18 rotas, incluindo
  `/expedicoes`, `/expedicoes/[id]` e `/expedicoes/percursos`).
- `npm run figma:check` → *plugin verificado sem problemas* (47 cenários).
- Banco conferido: 49 tabelas, 77 permissões, sem `remessa.*`/`rota.*`.

## Próximas ações

1. **Rodar `figma:harvest`** para colher as telas novas de expedição e conferir 1:1.
2. **Integração na saída** (opcional): a coluna `#` da expansão mostrar a ordem na
   expedição e uma ação "adicionar à expedição".
3. **Continuar a KAN-140:** baixas (RF016), inventário (RF015), validade (RF014).
4. **Revisar o diffuse** com `reviewer`/`qa` antes de integrar.
5. **Integrar na `main` e publicar** — exige aprovação do usuário.
6. **Jira:** reescrever a KAN-140 e fechar o worklog, com texto aprovado.
