# Projeto Nexus — Instruções para Agentes

## 1. Objetivo

Este repositório contém o **Nexus**, sistema web de controle de estoque e logística de remessas do projeto final do Técnico em Informática — FAETEC 2026.

O sistema centraliza:

* cadastro de produtos;
* controle de estoque;
* pedidos e notas de saída;
* remessas e entregas;
* expedições e percursos;
* inventário;
* usuários, perfis e permissões;
* auditoria;
* mural de mensagens;
* relatórios e exportações.

O comportamento funcional e as regras do domínio estão documentados nos arquivos de referência. **Não use a memória da conversa como fonte de verdade quando o repositório possuir a informação correspondente.**

---

# 2. Fonte de verdade

Ao trabalhar no projeto, siga esta prioridade:

1. **Código existente e configuração atual do projeto**
2. `prisma/schema.prisma` — modelo físico atual do banco
3. `docs/dominio/REGRAS_NEGOCIO.md` — regras de negócio
4. `docs/dominio/REQUISITOS_FUNCIONAIS.md` — requisitos funcionais
5. `docs/dominio/REQUISITOS_NAO_FUNCIONAIS.md` — requisitos não funcionais
6. `docs/dominio/ENTENDIMENTO.md` — entendimento detalhado do domínio e da modelagem
7. `docs/dominio/IMPLEMENTACAO.md` — o que já existe no código (estado atual, não especificação)
8. `docs/diagramas/classes.puml` — modelo conceitual
9. `docs/diagramas/DER.puml` — modelo entidade-relacionamento
10. `docs/diagramas/fluxo_atual.puml` e `docs/diagramas/fluxosAtuais/*.puml` — fluxo operacional **AS-IS manual** (não é o fluxo alvo do sistema)
11. Histórico da conversa — somente como contexto adicional

O índice da documentação é `docs/README.md`.

Se houver divergência entre a conversa e os arquivos atuais do projeto, **considere o estado atual do repositório como fonte de verdade** e informe a divergência.

Não invente entidades, campos, relações, regras ou fluxos que não estejam documentados ou presentes no código.

---

# 3. Stack

A aplicação é uma aplicação web Full Stack baseada em:

* Next.js 16 com App Router;
* TypeScript;
* Prisma 7;
* MySQL/MariaDB (driver `@prisma/adapter-mariadb`);
* autenticação própria com BCrypt + JWT (biblioteca `jose`, HS256);
* Git/GitHub.

A estrutura real do projeto é:

```text
src/
├── app/            # App Router: páginas, layouts e Server Actions (um diretório por módulo)
├── components/     # componentes React reutilizáveis
├── dao/            # Data Access Objects (Prisma queries)
├── services/       # regras de negócio
├── lib/            # utilitários e infraestrutura compartilhada
├── types/          # tipos TypeScript compartilhados
└── proxy.ts        # proteção das rotas privadas (sessão)

prisma/
├── schema.prisma   # modelo físico (52 entidades)
└── seed.ts         # seed de referência

docs/
├── README.md       # índice
├── dominio/        # ENTENDIMENTO, REGRAS_NEGOCIO, REQUISITOS_*, IMPLEMENTACAO
├── processo/       # VERSIONAMENTO, JIRA, WORKFLOW
└── diagramas/      # classes.puml, DER.puml, fluxo_atual.puml, fluxosAtuais/

tests/              # testes automatizados (Vitest)
scripts/            # scripts de apoio ao workflow
tools/              # ferramental (exportação para o Figma)
```

Não existe `src/app/api/`: a interface consome Server Actions e DAOs diretamente (ver §15).
O projeto **não versiona migrations** — o schema é aplicado com `prisma db push`
(`npm run db:push` / `npm run db:setup`), não com `prisma migrate`.

Antes de assumir que essa estrutura continua válida, verifique o estado real do repositório.

---

# 4. Regra fundamental: leia antes de alterar

Antes de implementar uma tarefa:

1. identifique quais partes do sistema são afetadas;
2. leia os arquivos de documentação relevantes;
3. leia o código existente relacionado;
4. consulte `prisma/schema.prisma` para qualquer operação relacionada ao banco;
5. verifique as configurações atuais (`package.json`, `tsconfig.json`, etc.);
6. somente então proponha ou faça alterações.

Não substitua leitura do código por suposições baseadas no histórico da conversa.

Para tarefas pequenas, leia apenas o contexto necessário.

Para tarefas envolvendo regras de negócio, leia também as RNs relacionadas.

---

# 5. Alterações manuais feitas pelo usuário

O usuário pode alterar arquivos diretamente durante uma sessão do agente.

Depois de uma interrupção, alteração manual ou mudança relevante no projeto:

* considere os arquivos atuais como estado válido;
* não tente restaurar automaticamente o estado anterior da conversa;
* releia os arquivos afetados;
* use `git diff` quando necessário para entender alterações recentes;
* não sobrescreva alterações manuais sem verificar sua intenção.

Se o estado atual do código contradizer o que estava sendo discutido anteriormente, **confie no código atual e reavalie a tarefa a partir dele**.

---

# 6. Banco de dados

O banco utiliza MySQL e Prisma.

O arquivo:

```text
prisma/schema.prisma
```

é a fonte de verdade para o modelo físico atual.

Nunca invente campos ou relações com base apenas na documentação.

Antes de alterar o schema:

1. leia o schema atual;
2. identifique as relações afetadas;
3. verifique o impacto no código existente;
4. aplique a mudança com `prisma db push` (`npm run db:push`) — o projeto **não usa migrations**;
5. avalie o impacto sobre integridade e histórico;
6. só então altere o schema.

Não altere o schema apenas para facilitar uma implementação de frontend.

---

# 7. Convenções de dados

As convenções documentadas são:

* IDs: `INT AUTO_INCREMENT`;
* PKs seguem `ID_entidade`;
* banco: `snake_case`;
* TypeScript: `camelCase`;
* entidades de cadastro possuem `ativo`;
* **hard delete é proibido** para entidades de cadastro;
* desativação deve ser utilizada no lugar de exclusão física.
* **Exceções (sem `ativo`, exclusão física):** `conversao_unidade` e `percurso` são
  excluídos fisicamente e não possuem `ativo`; as demais entidades de cadastro continuam
  com desativação (`ativo = false`).

Preserve as convenções existentes do projeto.

Não introduza uma convenção nova apenas por preferência pessoal.

---

# 8. Integridade do estoque

O estoque é uma área crítica do sistema.

O modelo diferencia:

```text
quantidade_atual
saldo_reservado
saldo_disponivel
```

A regra é:

```text
saldo_disponivel = quantidade_atual - saldo_reservado
```

## 8.1 Entrada

Uma entrada confirmada:

```text
quantidade_atual += quantidade_convertida
```

e gera registro de movimentação de estoque.

## 8.2 Reserva (nota de saída Remessa)

Criar uma **nota de saída do tipo Remessa (`SAIDA`) com itens e destinatário** reserva estoque:

```text
saldo_reservado += quantidade
```

A reserva pertence **à nota de saída** — não existe mais um nível intermediário de remessa. Criar a
nota também não representa baixa física definitiva.

**Avaria (`AVARIA`) e Consumo Interno (`CONSUMO_INTERNO`)** não são remessa: não têm destinatário,
**não reservam** e dão **baixa real na criação** (`quantidade_atual -= quantidade`, com movimentação
negativa e `ID_nota_saida`); a nota nasce `BAIXA_TOTAL`, com `qtd_entregue = qtd_esperada`. A
reserva acima vale apenas para Remessa.

## 8.3 Cancelamento

O cancelamento da **nota de saída em Remessa** libera a reserva:

```text
saldo_reservado -= quantidade
```

A nota vai para `CANCELADA` e permanece no histórico (RN004); cancelar de novo é recusado
sem debitar a reserva outra vez. Notas de Avaria/Consumo Interno já baixadas não são canceláveis —
são histórico; a correção é uma nota nova.

## 8.4 Nota baixada

A baixa definitiva ocorre quando a entrega da nota é finalizada:

```text
quantidade_atual -= quantidade_entregue
saldo_reservado -= quantidade_entregue
```

Qualquer implementação relacionada a estoque deve preservar essa distinção.

---

# 9. Regras de negócio críticas

As regras abaixo nunca devem ser alteradas ou reinterpretadas silenciosamente.

## RN001 — Saldo insuficiente

Estoque insuficiente deve gerar **aviso**, mas não bloqueio.

O fluxo deve poder continuar mesmo quando o saldo disponível for insuficiente.

## RN002 — Validade

Produtos perecíveis devem gerar alertas no mural quando estiverem a:

* 90 dias;
* 60 dias;
* 45 dias;
* 30 dias

do vencimento.

## RN003 — Entrega parcial

Uma entrega parcial gera uma pendência automática para os itens restantes.

Os itens não entregues permanecem comprometidos conforme o modelo de reserva e podem seguir para nova remessa/expedição.

A "pendência" é a própria remessa `PENDENTE` criada no split (vinculada por `remessa.ID_destinatario`) — sem tabela nova. Decisão do usuário de 2026-10-19, detalhada em `docs/dominio/ENTENDIMENTO.md` §3.11.2; o sentido da regra não mudou.

## RN004 — Imutabilidade do histórico

Entradas confirmadas e baixas finalizadas **não podem ser excluídas fisicamente**.

Correções devem gerar os registros corretivos/auditáveis apropriados.

Nunca "corrija" histórico simplesmente sobrescrevendo ou apagando o registro original.

## RN005 — Inventário

Diferenças encontradas durante inventário **não geram ajuste automático**.

Toda diferença precisa de aprovação manual por usuário com:

```text
inventario.aprovar_ajuste
```

---

# 10. Auditoria

O sistema possui trilha de auditoria.

Alterações relevantes devem preservar:

* usuário responsável;
* data/hora;
* entidade;
* ID da entidade;
* dados anteriores;
* dados novos.

Os snapshots anteriores e posteriores são armazenados em JSON.

Ao implementar operações de alteração, correção ou desativação, verifique se a operação exige registro em `registro_auditoria`.

Não remova mecanismos de auditoria para simplificar uma implementação.

---

# 11. Inventário

O inventário possui fluxo próprio:

```text
ABERTO
  ↓
EM_CONTAGEM
  ↓
AGUARDANDO_APROVACAO
  ↓
FINALIZADO
```

Regras importantes:

* o snapshot de `quantidade_sistema` deve ser preservado;
* o bloqueio é por produto/item em inventário, não necessariamente global;
* podem existir múltiplas contagens;
* contagem cega depende de permissão;
* o sistema apresenta média das contagens;
* o aprovador pode escolher uma contagem individual;
* diferenças exigem aprovação;
* rejeição não altera o estoque;
* aprovação gera o ajuste e a movimentação correspondente.

Não implemente ajuste automático simplesmente porque existe uma diferença entre estoque físico e sistema.

---

# 12. Autenticação e permissões

As permissões seguem:

```text
entidade.acao
```

Exemplos:

```text
produto.criar
estoque.ver_saldo
inventario.abrir
inventario.aprovar_ajuste
relatorio.gerar
```

As permissões são pré-definidas.

Perfil é um **template de permissões**.

Aplicar um perfil a um usuário:

1. substitui as permissões atuais pelas permissões do perfil;
2. não mantém vínculo permanente com o perfil;
3. permite alterações individuais posteriores.

## Super Admin

O Super Admin é identificado pela flag:

```text
super_admin
```

Ele:

* possui todas as permissões;
* ignora as verificações normais de permissão;
* não deve aparecer como uma permissão configurável pela interface;
* existe apenas um Super Admin.

Não substitua essa regra por um perfil comum sem alterar formalmente a especificação.

---

# 13. Soft delete

Não utilize:

```text
DELETE FROM ...
```

para excluir fisicamente entidades de cadastro.

Quando a entidade possuir `ativo`, utilize a desativação prevista pelo domínio.

**Exceções:** `conversao_unidade` e `percurso` são excluídos fisicamente e **não possuem
`ativo`** — a exclusão é permanente e o snapshot anterior fica na auditoria. As demais
entidades de cadastro continuam com desativação.

Históricos operacionais e registros de auditoria devem permanecer preservados.

---

# 14. Entregas e expedições

O ciclo operacional principal é:

```text
Nota de Saída (destinatário + itens + reserva)
    ↓
Expedição (manifesto: veículo, condutor, ordem)
    ↓
Preparação
    ↓
Percurso
    ↓
Entrega
    ↓
Baixa
```

Status e transições devem respeitar o modelo documentado.

Uma nota pendente pode ser adicionada posteriormente a outra expedição.

Entrega parcial deve preservar a rastreabilidade da quantidade entregue e da quantidade restante;
a pendência é a própria nota em `BAIXA_PARCIAL` (sem split e sem remessa).

Não implemente um novo fluxo de entrega sem verificar:

* `nota_saida`;
* `item_nota_saida`;
* `expedicao`;
* `expedicao_nota`;
* `coleta`.

---

## 15. Código e arquitetura

Prefira a arquitetura já existente no projeto.

**Server Actions são o padrão para mutações e leituras da UI.** API Routes (`src/app/api/`) devem ser usadas apenas quando o endpoint precisa ser consumido por sistemas externos (webhooks, integrações) ou quando a Server Action não atende (ex: upload de arquivo grande com progresso). Nunca crie uma API Route para servir a própria interface — chame o DAO diretamente via Server Action.

Quando apropriado:

```text
UI / Route Handler
       ↓
Service
       ↓
DAO
       ↓
Prisma
       ↓
MySQL
```

Responsabilidades:

* `components/`: apresentação e interação;
* `app/`: páginas, layouts e endpoints/Route Handlers;
* `services/`: regras de negócio e casos de uso;
* `dao/`: acesso aos dados;
* `lib/`: utilitários e infraestrutura compartilhada;
* `types/`: tipos TypeScript compartilhados.

Não mova código entre camadas sem necessidade.

Não coloque regra de negócio complexa diretamente em componentes React.

Não coloque queries Prisma arbitrárias em componentes de interface.

---

# 16. Operações de banco e consistência

Operações que alteram simultaneamente múltiplos registros relacionados devem considerar transações.

Especialmente:

* entrada de estoque;
* reserva/liberação de estoque;
* baixa de remessa;
* correção de notas;
* ajustes de inventário;
* desmontagem de produtos compostos;
* operações que alteram estoque + auditoria.

Uma operação não deve deixar o banco em estado parcialmente atualizado.

Ao implementar uma operação de estoque, pense sempre no conjunto:

```text
registro operacional
+
estoque
+
reserva
+
movimentação
+
auditoria
```

quando aplicável.

---

# 17. Frontend

A interface deve priorizar:

* simplicidade;
* clareza;
* baixo atrito operacional;
* feedback explícito;
* compatibilidade com o fluxo dos operadores do galpão.

O sistema possui requisito de desempenho para buscas por código de barras e Kanban em rede local.

Não adicione complexidade visual ou interações sofisticadas sem necessidade funcional.

---

# 18. Relatórios

Relatórios são consultas sobre os dados existentes.

Os relatórios previstos incluem:

* movimentação de estoque;
* expedições por período;
* entregas por instituição;
* produtos próximos ao vencimento;
* listagem simplificada de produtos;
* auditoria;
* consolidado semestral.

Os formatos previstos incluem:

```text
PDF
CSV
XLSX
```

Ao implementar relatórios:

* reutilize as queries/serviços existentes quando possível;
* aplique os filtros no servidor;
* não carregue grandes volumes de dados desnecessariamente no cliente;
* preserve as permissões do usuário;
* não altere os dados apenas para gerar um relatório.

---

# 19. Segurança

Nunca exponha:

* senhas;
* `senha_hash`;
* JWT secrets;
* credenciais de banco;
* variáveis privadas do ambiente;
* chaves de API.

Não coloque segredos em código-fonte, documentação ou logs.

A autenticação utiliza BCrypt + JWT conforme a especificação atual.

Não substitua o mecanismo de autenticação por outra biblioteca ou arquitetura sem solicitação explícita.

---

# 20. Dependências

Antes de adicionar uma biblioteca:

1. verifique `package.json`;
2. verifique se uma biblioteca existente já resolve o problema;
3. considere o impacto no bundle e na arquitetura;
4. adicione somente a dependência necessária;
5. não substitua bibliotecas existentes sem necessidade.

Não atualize versões de dependências não relacionadas à tarefa.

---

# 21. Workflow de implementação

Para cada tarefa:

### Etapa 1 — Entender

Leia a documentação e o código relacionados.

### Etapa 2 — Planejar

Identifique:

* arquivos que serão alterados;
* entidades envolvidas;
* regras de negócio afetadas;
* impactos no banco;
* impactos na interface.

### Etapa 3 — Implementar

Faça a menor alteração necessária para cumprir a tarefa.

Preserve o código existente que não precisa ser alterado.

### Etapa 4 — Validar

Execute os checks disponíveis no projeto, por exemplo:

```bash
npm run lint
npm run build
```

ou os comandos equivalentes definidos em `package.json`.

Para alterações de banco, valide também o schema Prisma (`npm run db:generate` + `npm run db:push`) e a conexão com o banco conforme o workflow atual do projeto.

### Etapa 5 — Revisar

Antes de finalizar:

* verifique o diff;
* procure alterações acidentais;
* confirme que regras de negócio não foram quebradas;
* confirme que não existem segredos expostos;
* confirme que a implementação corresponde à tarefa solicitada.

### Etapa 6 — Relatar

Informe objetivamente:

* o que foi alterado;
* quais arquivos foram modificados;
* quais validações foram executadas;
* eventuais limitações ou pendências.

---

# 22. Não fazer

Nunca:

* inventar campos ou tabelas;
* inventar regras de negócio;
* ignorar `prisma/schema.prisma`;
* apagar histórico operacional;
* transformar soft delete em hard delete;
* bloquear automaticamente uma operação que RN001 determina que deve apenas emitir alerta;
* gerar ajuste automático de inventário;
* alterar estoque sem considerar auditoria/movimentação/reserva quando aplicável;
* expor credenciais;
* sobrescrever alterações manuais sem verificar o diff;
* alterar dependências não relacionadas;
* modificar arquitetura por preferência pessoal;
* considerar o histórico da conversa mais confiável que o código/documentação atual.

---

# 23. Quando houver dúvida

Se a implementação depender de uma decisão que os arquivos não definem:

1. não invente a regra;
2. identifique exatamente o ponto de ambiguidade;
3. consulte arquivos relacionados;
4. se continuar indefinido, pergunte ao usuário antes de implementar uma decisão estrutural.

Quando existirem duas interpretações possíveis, apresente as duas e indique quais arquivos/regras estão envolvidos.

---

# 24. Regra final

**O repositório é a memória do projeto.**

A conversa fornece contexto temporário.

Se uma informação importante precisar continuar válida entre sessões, ela deve ser registrada no arquivo apropriado do repositório:

* regra de desenvolvimento → `AGENTS.md`;
* regra de negócio → `docs/dominio/REGRAS_NEGOCIO.md`;
* requisito → `docs/dominio/REQUISITOS_FUNCIONAIS.md` ou `docs/dominio/REQUISITOS_NAO_FUNCIONAIS.md`;
* entendimento/modelagem → `docs/dominio/ENTENDIMENTO.md`;
* o que já existe no código → `docs/dominio/IMPLEMENTACAO.md`;
* modelo físico → `prisma/schema.prisma`;
* arquitetura real → código/configuração atual.

Não dependa da memória da sessão para preservar conhecimento essencial do projeto.

### Exportação para o Figma (ferramental de design)

As telas do sistema podem ser exportadas para o Figma por um plugin local — sem o MCP
oficial. O ferramental vive em `tools/figma-export/`.

**Antes de mexer nessa ferramenta, leia:**

| Documento | Para quê |
| --- | --- |
| `tools/figma-export/MAPA.md` | arquitetura, contrato de dados, invariantes, armadilhas da API do Figma e **histórico de bugs** |
| `tools/figma-export/README.md` | passo a passo de uso |
| `.opencode/skills/figma-export/SKILL.md` | roteiro operacional (carregado como skill) |

Pontos que afetam o trabalho no dia a dia:

1. Os componentes compartilhados em `src/components/` possuem atributos `data-figma*`
   (ex.: `data-figma="Button"`, `data-figma-variant`, `data-figma-label`,
   `data-figma-hug`, `data-figma-slot`, `data-figma-columns`). Eles são lidos
   pela exportação para gerar **componentes e propriedades** no Figma.
   **Não remova nem renomeie esses atributos**: eles são a única marcação que liga a UI aos
   componentes do design, e não alteram comportamento nem visual.
2. Ao criar ou alterar uma primitiva compartilhada, mantenha a marcação no elemento raiz.
3. A colheita usa um banco isolado (`nexus_figma_export`) e fixtures próprios; nunca lê nem
   escreve no banco de desenvolvimento.
4. Qualquer correção nessa ferramenta deve virar uma **invariante** em
   `npm run figma:check` (que roda o plugin contra um mock da Plugin API, sem abrir o
   Figma) — foi assim que os bugs de fidelidade foram encontrados e travados.
5. Existe também o **caminho de volta**: os designers copiam os componentes para uma
   página própria (`Page 1`) e editam a cópia lá (a reexportação reconstrói
   `Nexus · Componentes` e os frames `· EDIT`/`· REF`). O plugin tem a aba **Ler do
   Figma** e `npm run figma:diff` produz `out/figma-export/diff-design.md` dizendo o que
   mudou em **tokens**, **componentes** (com o arquivo do código, pela âncora `Origem:`
   na descrição de cada mestre) e **telas**. Regra que não pode quebrar: **manter o nome
   do componente** — o casamento é por nome, não por vínculo. Detalhes em
   `tools/figma-export/MAPA.md` §11.

### Integração GitHub + Jira (Smart Commits)

Para que os commits apareçam linkados às tasks no Jira, toda mensagem de commit deve incluir a **chave do issue** correspondente no formato:

```text
KAN-123: descrição do que foi feito
```

Ou, para ações via **Smart Commit**:

```text
KAN-123 #comment ajuste no cálculo do frete
```

- `KAN-123` — chave do issue (obrigatória em todo commit relacionado a uma task)
- `#comment <texto>` — adiciona um comentário ao issue (opcional)
- `#resolve` ou `#close` — faz a transição do issue para concluído (usar somente quando os critérios de aceite forem atendidos)
- **`#time` não é suportado** — não registrar horas por comentário.

### Regras

1. **Sempre incluir a chave do Jira** no commit message quando o commit implementar, corrigir ou estiver relacionado a uma task.
2. **Usar a chave no início da mensagem**: `KAN-139: feat: busca priorizada na listagem de produtos`
3. **Branch names** também devem conter a chave quando possível: `KAN-139-modulo-produtos`
4. **Não associar commits a issues errados** apenas por similaridade superficial.
5. **Nunca comentar em uma task sem antes propor o conteúdo ao usuário e obter aprovação.** Nenhum comentário deve ser publicado automaticamente.
6. **Registrar tempo apenas via worklog do MCP** (`addOrEditJiraIssueWorklog`), nunca por comentário ou `#time`.

As regras completas de integração com o Jira estão em `docs/processo/JIRA.md`.

Quando o MCP do Jira estiver disponível, seguir essas regras antes de
iniciar alterações significativas e ao finalizar o trabalho.

---

### Arquitetura multiagente e estado persistente

O trabalho é orquestrado por agentes versionados em `.opencode/agents/` (orquestrador +
subagentes especializados), com **estado persistente** em `.ai-workflow/` e skills de
processo em `.opencode/skills/`. O fluxo completo está em `docs/processo/WORKFLOW.md`; o
estado corrente, em `.ai-workflow/PROJECT_STATE.md`.

Regras:

1. Os objetivos chegam pela sessão do **orquestrador**, que delega e consolida — não
   absorve o trabalho técnico.
2. Toda delegação gera um **contrato de tarefa**
   (`.ai-workflow/contracts/TASK_CONTRACT_TEMPLATE.md`) com run id, issue Jira, escopo,
   critérios de aceite e testes.
3. Um relatório de agente **não é prova**: o orquestrador valida Git/Jira antes de
   consolidar. Falha nunca é tratada como sucesso.
4. Um run = um arquivo em `.ai-workflow/runs/`; o estado consolidado tem **escritor único**
   (o orquestrador).
5. Versionamento **DateVer** `N.DD.MM.YYYY` → tag `vN.DD.MM.YYYY` (N começa em 1), com
   `CHANGELOG.md` no padrão Keep a Changelog 1.1.0 (pt-BR).
6. Branches de trabalho `KAN-<n>-<slug>`; integração na `main`.

A convenção detalhada de versionamento e changelog (DateVer + Keep a Changelog) está em
`docs/processo/VERSIONAMENTO.md`; o checklist operacional de release, em
`.opencode/skills/release/SKILL.md`.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
