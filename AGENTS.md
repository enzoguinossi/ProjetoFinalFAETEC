# Projeto Nexus — Instruções para Agentes

## 1. Objetivo

Este repositório contém o **Nexus**, sistema web de controle de estoque e logística de remessas do projeto final do Técnico em Informática — FAETEC 2026.

O sistema centraliza:

* cadastro de produtos;
* controle de estoque;
* pedidos e notas de saída;
* remessas e entregas;
* rotas e percursos;
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
3. `docs/REGRAS_NEGOCIO.md` — regras de negócio
4. `docs/REQUISITOS_FUNCIONAIS.md` — requisitos funcionais
5. `docs/REQUISITOS_NAO_FUNCIONAIS.md` — requisitos não funcionais
6. `docs/ENTENDIMENTO.md` — entendimento detalhado do domínio e da modelagem
7. `docs/puml/classes.puml` — modelo conceitual
8. `docs/puml/DER.puml` — modelo entidade-relacionamento
9. `docs/fluxo_atual.puml` — fluxo operacional
10. Histórico da conversa — somente como contexto adicional

Se houver divergência entre a conversa e os arquivos atuais do projeto, **considere o estado atual do repositório como fonte de verdade** e informe a divergência.

Não invente entidades, campos, relações, regras ou fluxos que não estejam documentados ou presentes no código.

---

# 3. Stack

A aplicação é uma aplicação web Full Stack baseada em:

* Next.js 14+ com App Router;
* TypeScript;
* Prisma 7;
* MySQL;
* autenticação própria com BCrypt + JWT (biblioteca `jose`, HS256);
* Git/GitHub.

A estrutura conceitual esperada é:

```text
src/
├── app/
│   ├── api/
│   ├── (auth)/
│   └── (dashboard)/
├── components/
├── dao/
├── services/
├── lib/
└── types/

prisma/
├── schema.prisma
├── seed.ts
└── migrations/

docs/
├── ENTENDIMENTO.md
├── REGRAS_NEGOCIO.md
├── REQUISITOS_FUNCIONAIS.md
├── REQUISITOS_NAO_FUNCIONAIS.md
└── puml/
```

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
4. verifique migrations existentes;
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

## 8.2 Nota de saída

Criar uma Nota de Saída **reserva** estoque:

```text
saldo_reservado += quantidade
```

A criação da nota não representa baixa física definitiva.

## 8.3 Cancelamento

O cancelamento libera a reserva:

```text
saldo_reservado -= quantidade
```

## 8.4 Remessa finalizada

A baixa definitiva ocorre quando a remessa é finalizada:

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

Os itens não entregues permanecem comprometidos conforme o modelo de reserva e podem seguir para nova remessa/rota.

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

Históricos operacionais e registros de auditoria devem permanecer preservados.

---

# 14. Remessas e rotas

O ciclo operacional principal é:

```text
Nota de Saída
    ↓
Reserva de estoque
    ↓
Remessa
    ↓
Rota
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

Uma remessa pendente pode ser adicionada posteriormente a outra rota.

Entrega parcial deve preservar a rastreabilidade da quantidade entregue e da quantidade restante.

Não implemente um novo fluxo de entrega sem verificar:

* `nota_saida`;
* `item_nota_saida`;
* `remessa`;
* `item_remessa`;
* `rota`;
* `rota_remessa`;
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

Para alterações de banco, valide também Prisma, migrations e conexão com MySQL conforme o workflow atual do projeto.

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
* regra de negócio → `docs/REGRAS_NEGOCIO.md`;
* requisito → `docs/REQUISITOS_FUNCIONAIS.md` ou `docs/REQUISITOS_NAO_FUNCIONAIS.md`;
* entendimento/modelagem → `docs/ENTENDIMENTO.md`;
* modelo físico → `prisma/schema.prisma`;
* arquitetura real → código/configuração atual.

Não dependa da memória da sessão para preservar conhecimento essencial do projeto.

### Integração GitHub + Jira (Smart Commits)

Para que os commits apareçam linkados às tasks no Jira, toda mensagem de commit deve incluir a **chave do issue** correspondente no formato:

```text
KAN-123: descrição do que foi feito
```

Ou, para ações avançadas via **Smart Commit**:

```text
KAN-123 #comment ajuste no cálculo do frete #time 2h 30m
```

- `KAN-123` — chave do issue (obrigatória em todo commit relacionado a uma task)
- `#comment <texto>` — adiciona um comentário ao issue (opcional)
- `#time <duração>` — registra worklog no Jira (opcional, ex: `1h`, `30m`, `2h 30m`)
- `#resolve` ou `#close` — faz a transição do issue para concluído (usar somente quando os critérios de aceite forem atendidos)

### Regras

1. **Sempre incluir a chave do Jira** no commit message quando o commit implementar, corrigir ou estiver relacionado a uma task.
2. **Usar a chave no início da mensagem**: `KAN-139: feat: busca priorizada na listagem de produtos`
3. **Branch names** também devem conter a chave quando possível: `KAN-139-modulo-produtos`
4. **Não associar commits a issues errados** apenas por similaridade superficial.
5. Após finalizar uma implementação, registrar o resumo no Jira via comentário e worklog.

As regras completas de integração com o Jira estão em `docs/agents/JIRA.md`.

Quando o MCP do Jira estiver disponível, seguir essas regras antes de
iniciar alterações significativas e ao finalizar o trabalho.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
