# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-25 (mural, alertas de validade, sino e gráficos no dashboard).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** As três últimas releases
publicadas são `1.17.10.2026`, `3.24.10.2026` e `4.24.10.2026`; a `main` local está
**um commit à frente** de `origin/main` (`fff7076`), com a feature de mural/validades/
gráficos (`dc24eca`). O servidor de produção está **parado** (3001) e o banco
`nexus_prod` ainda precisa do `db push`.

## Entregue no commit `dc24eca` (2026-10-25)

1. **Mural de mensagens (KAN-156, RF009)** — card no dashboard, antes dos gráficos e sem
   página `/mural`; mensagens manuais com CRUD por modal, automáticas somente leitura,
   autor, expiração e permissões; “Ver anteriores” com manuais e automáticas anteriores.
2. **Sino de mensagens novas (KAN-156)** — contagem por usuário em
   `usuario.mural_visto_em` (banco, vários terminais), polling de 60 s e foco/
   visibilidade; clique marca como visto e leva a `/dashboard#mural`.
3. **Alertas de validade (KAN-140, RN002/RF014)** — uma mensagem automática ativa por
   produto perecível nas faixas 90/60/45/30; ao mudar de faixa a anterior é desativada e
   fica no histórico; produto vencido/inativo desativa a ativa; geração idempotente no
   dashboard, no fuso de São Paulo.
4. **Gráficos e KPIs reais (KAN-140, KAN-156)** — `chart.js` + `react-chartjs-2`;
   movimentações de 6 meses, top 5 estoque e notas por status; KPIs de estoque, saídas
   pendentes, expedições em percurso e vencendo em 30 dias; pendências reais; permissões
   e estados vazios.

O `CHANGELOG.md` já tem a entrada em `[Unreleased]`.

## Estado verificado (2026-10-25)

- **Git:** `main` em `dc24eca`; `origin/main` em `fff7076`; tags
  `v3.24.10.2026` e `v4.24.10.2026`; **nada empurrado desde a 4.24**.
- **Testes:** `npm test` → **416/416 (35 arquivos)**, incluindo os testes de mural,
  validade, sino, dashboard e imutabilidade do histórico.
- **Qualidade:** `npm run lint` ok; `npm run build` e `npm run figma:check` verdes na
  validação do developer; conferência visual do dashboard, mural, modais, histórico,
  sino (2→0 e 0→1) e faixa 90→30. O ajuste final de imutabilidade alterou apenas serviço
  e teste; suíte e lint foram reexecutados.
- **Banco de desenvolvimento (`nexus`):** `prisma db push` aplicado para
  `mensagem_mural.chave` (única, nullable) e `usuario.mural_visto_em`; `prisma generate`
  ok. O `nexus_test` está sincronizado.
- **Produção:** worktree `C:\Users\Enzo\Documents\Code\projetofinalfaetec-prod` em
  `c1d2f8c` (3.24.10.2026), servidor 3001 **parado**; `nexus_prod` no schema antigo.
  O script `C:\Users\Enzo\Desktop\iniciar-producao.cmd` já faz pull/install/prisma/build/
  start/túnel e avisa sobre o `db push`.

## Decisões fechadas do usuário (2026-10-25)

- Marcador de leitura do mural **no banco** (`usuario.mural_visto_em`), porque o sistema
  é usado em vários terminais.
- **Chart.js + `react-chartjs-2`** para os gráficos.
- “Ver anteriores” inclui **também as manuais** desativadas/expiradas, além das
  automáticas anteriores.
- **Uma** mensagem ativa por produto vencendo; as anteriores desativadas e auditáveis.
- **Sem `/mural`**; o mural fica no dashboard, antes dos gráficos.
- Ordem da tela: PageTitle → KPI → Mural → gráficos → Pendências.

## Modelo atual (resumo)

- `nota_saida` = entrega (destinatário, itens, reserva e status); não existem `remessa`,
  `item_remessa` nem `StatusRemessa`.
- `StatusNotaSaida`: `ABERTA`, `EM_PERCURSO`, `PENDENTE`, `BAIXA_TOTAL`,
  `BAIXA_PARCIAL`, `BAIXA_COM_CORTE`, `CANCELADA`.
- `expedicao` = manifesto (veículo, condutor, data prevista, `PLANEJADA`/`EM_PERCURSO`/
  `CONCLUIDA`), com `expedicao_nota` e ordem de visita.
- `percurso`/`percurso_destinatario` são template, sem `ativo` (exclusão física), não
  gravados na expedição.
- `conversao_unidade`: `UNIDADE` (fator 1) é a única `padrao`, não excluível, com nome/
  fator travados; excluir outra revincula produtos à padrão.
- `mensagem_mural.chave` única só na automática ativa (`validade:{id}:{faixa}`); o
  histórico fica com `chave = null` e `ativo = false`. `usuario.mural_visto_em` é a marca
  de leitura do sino.

## Pendências reais

1. **Release e push** — a próxima release no dia 25/10 seria **`1.25.10.2026`**
   (tag `v1.25.10.2026`); exige aprovação do usuário. Não publicar ainda.
2. **Produção** — backup do `nexus_prod`, normalizar o CNPJ antes do `db push` e aplicar
   com consentimento: remove `fornecedor.contato` (1 valor), ajusta CPF/CNPJ, adiciona
   `nome_fantasia`, `chave` e `mural_visto_em`; depois atualizar a worktree, build, start
   e smoke. O servidor 3001 está parado.
3. **Escopo restante para 100%** — RF015 (inventário), RF020 (fotos da nota), RF024/XLSX
   e as partes pendentes de RF019/RF021; o usuário ainda não decidiu implementar ou
   declarar fora de escopo.
4. **Documentação/manual/apresentação** — KAN-149/150/151/152 e fechamento de KAN-157/
   KAN-144; qualquer comentário no Jira exige texto aprovado.
5. **Worklogs** — 13h55 no total do dia; 7h55 adicionados pelo assistente; 6h da KAN-140
   já existiam (início 09:00). Opcional: ajustar o worklog `#10126` para 10:00.

## Próximas ações

1. Obter aprovação para a release `1.25.10.2026` + push da `main`.
2. Preparar a produção (backup + normalização + `db push` com consentimento) e validar o
   smoke antes de liberar.
3. Decidir o escopo restante (RF015/RF020/XLSX/RF019/RF021) e atualizar docs/manual.
4. Fechar as issues do Jira com texto aprovado.

## Histórico recente

- **2026-10-25** — mural, alertas de validade, sino e gráficos (`dc24eca`); 416 testes;
  lint/build/figma verdes; dev DB atualizado; produção intocada.
- **2026-10-24** — releases `3.24.10.2026` (CPF, remoção de `fornecedor.contato`,
  impressão, imagens) e `4.24.10.2026` (CNPJ `VARCHAR(14)`, validação/máscara, BrasilAPI,
  `nome_fantasia`).
- **2026-10-24** — unidade padrão, tipo de saída e as telas de expedição.
- **2026-10-23** — fusão nota = entrega; módulo de expedições; execução da entrega.
- Runs anteriores: `.ai-workflow/runs/` (01–70).
