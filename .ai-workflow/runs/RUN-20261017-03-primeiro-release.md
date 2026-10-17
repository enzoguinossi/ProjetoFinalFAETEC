# RUN-20261017-03 — Primeiro release (DateVer `1.17.10.2026`)

## Identificação

- **Run ID:** `RUN-20261017-03`
- **Criado em:** 2026-10-17
- **Agente executor:** `release-manager` (delegado pelo `orchestrator`)
- **Solicitante:** usuário (sessão principal)
- **Profundidade de delegação:** `1/2`
- **Branch/worktree:** `figma-export` · **HEAD:** `b91d071` (árvore limpa)

## Objetivo e tarefa

- **Objetivo:** preparar — **sem publicar** — o primeiro release do projeto, versão
  **`1.17.10.2026`** (tag `v1.17.10.2026`).
- **Decisão do usuário que orienta o release:** tratar como a **primeira versão do código**,
  descrevendo **tudo o que está funcionando hoje** (não é changelog de deltas).
- **Tarefa:** inventariar o que funciona a partir do código real, conferir rastreabilidade
  issue ↔ commit ↔ changelog, escrever a seção da versão no `CHANGELOG.md`, cumprir o
  checklist de release e **propor** (sem executar) a tag e as operações de Jira.
- **Fora de escopo:** criar tag, `push`, transição/versão/comentário/worklog no Jira.

## Rastreabilidade

- **Issues desta entrega:** `KAN-165` (infraestrutura de orquestração multiagente) e
  `KAN-166` (ferramenta de exportação para o Figma).
- **Issues que compõem a primeira versão** (lidas do `git log`, sem inventar chave):
  `KAN-136`, `KAN-137`, `KAN-138`, `KAN-139`, `KAN-146`, `KAN-153`, `KAN-154`, `KAN-155`,
  `KAN-164`, além de `KAN-000` (manutenção/refactor sem issue própria).
- **Referências:** `docs/VERSIONAMENTO.md`, `.opencode/skills/release/SKILL.md`,
  `.ai-workflow/runs/RUN-20261017-01-infra-multiagente.md`,
  `.ai-workflow/runs/RUN-20261017-02-figma-export.md`,
  `.ai-workflow/runs/RUN-20261017-02e-endurecimento.md`.

## Escopo e restrições

- **Alterado:** `CHANGELOG.md`, este run.
- **Não alterado:** `src/**`, `prisma/**`, `tests/**`, `tools/**`, `.opencode/**`,
  `.ai-workflow/PROJECT_STATE.md` (escritor único = Orquestrador).

## Inventário do que funciona hoje (derivado do código)

Fontes: `src/app/**`, `src/components/**`, `src/dao/**`, `src/services/**`,
`prisma/schema.prisma`, cruzados com `docs/REQUISITOS_FUNCIONAIS.md`.

**Funciona (com tela e ação de servidor)**

| Módulo | Evidência |
|---|---|
| Autenticação, sessão, primeiro acesso, definição de senha, logout | `src/app/{login,primeiro-acesso,definir-senha}/`, `src/lib/{auth,jwt,cookies,permissoes}.ts`, `src/proxy.ts` |
| Usuários | `src/app/usuarios/**`, `src/dao/usuario.ts` |
| Perfis e permissões (`entidade.acao`, perfil-template, Super Admin) | `src/app/perfis/**`, `src/components/PermissoesPanel.tsx`, `src/services/permissao.ts` |
| Trilha de auditoria | `src/dao/_audit.ts` (usado por DAOs/serviços dentro de transação) |
| Funcionários | `src/app/funcionarios/**`, `src/dao/funcionario.ts` |
| Destinatários (escola/creche, endereço obrigatório) | `src/app/destinatarios/**`, `src/dao/destinatario.ts` |
| Fornecedores | `src/app/fornecedores/**`, `src/dao/fornecedor.ts` |
| Veículos | `src/app/veiculos/**`, `src/dao/veiculo.ts` |
| Produtos (foto WEBP, perecível/validade, composto/insumos, conversão padrão, quantidade livre) | `src/app/produtos/**`, `src/dao/produto.ts`, `src/lib/imagem.ts` |
| Códigos personalizados por entidade | `src/services/codigo.ts`, `src/lib/codigo.ts`, `src/components/CodigosSection.tsx` |
| Contatos (telefone/e-mail) e endereço com CEP | `src/services/{contato,cep}.ts`, `src/components/{ContatosSection,EnderecoFields}.tsx` |
| Unidades de conversão (modal do produto) | `src/app/unidades/actions.ts`, `src/components/UnidadesModal.tsx` |
| Listagens paginadas com busca priorizada | `src/components/{DataTable,TablePagination,SearchBar}.tsx`, `src/lib/{use-lista-paginada,use-crud-lista}.ts` |
| Interface (Tailwind v4 + componentes compartilhados + marcas `data-figma`) | `src/app/globals.css`, `src/components/**`, `src/app/layout.tsx` |

**Existe mas sem tela / não entregue nesta versão**

- `src/app/dashboard/page.tsx`: só leiaute, com números fixos — **não consulta o banco**.
- `src/components/sidebar-config.ts` aponta para `/mov-estoque`, `/pedidos` e `/relatorios`:
  **não existem** essas páginas em `src/app/**`.
- `src/services/estoque.ts` e `src/dao/estoque.ts` existem e são cobertos por testes, mas
  **não são chamados por nenhuma action/tela** (nenhuma movimentação é exposta).
- Sem `src/app/api/**` (nenhuma API Route): mutações e leituras são Server Actions, conforme
  `AGENTS.md` §15.
- Sem entrega para: notas de entrada/saída, remessas, rotas/percursos, inventário, mural de
  mensagens, relatórios/exportações, leitura por código de barras e importação de NF-e —
  a maior parte desses RFs (RF012, RF014–RF025) **não está implementada**.

## Checklist de release (`.opencode/skills/release/SKILL.md`)

| # | Item | Situação | Evidência |
|---|---|---|---|
| 1 | Entregas aprovadas (reviewer sem bloqueante; QA verde) | ✅ | `RUN-20261017-02` §Revisão e QA: reviewer com 1 bloqueante **dispensado pelo usuário** (critério do `compare`) tratado no `RUN-20261017-02e`; QA 6/6; sem regressões |
| 2 | Rastreabilidade issue → commit → changelog | ✅ | chaves do `git log` conferidas; cada entrada cita a issue e/ou arquivo |
| 3 | Changelog atualizado (categorias corretas, sem duplicidade) | ✅ | `CHANGELOG.md` `[1.17.10.2026]`; `[Unreleased]` vazio; conteúdo do `Unreleased` movido, sem repetir entrada |
| 4 | Documentação `/docs` atualizada | ✅ | `docs/VERSIONAMENTO.md` (`bf114b7`, `25fa7b2`), `docs/agents/WORKFLOW.md`, `tools/figma-export/MAPA.md` §9/§11 |
| 5 | Testes executados com resultado registrado | ✅ | ver abaixo |
| 6 | Versão DateVer e tag propostas ao usuário | ✅ | `1.17.10.2026` / `v1.17.10.2026` (fuso `America/Sao_Paulo`, dia 17/10/2026, 1ª release do dia) |
| 7 | Aprovação do usuário para commit final, tag e push | ⏳ | **pendente** — nada foi tagueado nem enviado |

### Testes (executados nesta preparação)

- `npm run figma:check` → **verde** (exit 0): fidelidade da montagem e resiliência em 0,
  21/21 componentes promovidos com a marca no código, 53 mestres, 6 pacotes.
- `node scripts/ai-workflow-check.mjs` → **13/13 automáticos ok, 2 manuais, 0 falhas**.
- `npm test` → **165/165** em 18 arquivos (Vitest).
- `npx tsc --noEmit` → **limpo** (exit 0).
- Registro anterior (`RUN-20261017-02`): `figma:harvest` 47/47, `eslint` e `next build`
  verdes — não repetidos aqui (a colheita depende do servidor de desenvolvimento).

## Resultado

- **Status:** **preparado — aguarda a aprovação do usuário** (não publicar sem ela).
- **Changelog:** `[Unreleased]` vazio; `[1.17.10.2026] - 2026-10-17` descreve os módulos do
  sistema, a infraestrutura multiagente e a ferramenta Figma, mais `Changed`/`Fixed` do ciclo.
- **Não executado (de propósito):** tag `v1.17.10.2026`, `git push`, qualquer escrita no Jira
  (transição, versão de projeto, comentário, worklog).
- **Pendências:** (a) aprovação do usuário para o commit/tag/push; (b) atualizar
  `.ai-workflow/PROJECT_STATE.md` **após** a publicação (escritor único: Orquestrador);
  (c) confirmar no Jira se a versão de projeto `1.17.10.2026` deve ser criada e as issues
  `KAN-165`/`KAN-166` associadas a ela.
