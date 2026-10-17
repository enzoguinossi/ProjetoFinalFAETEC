## Jira e gerenciamento de tarefas

O projeto utiliza o **Jira** para planejamento, acompanhamento e registro do trabalho de desenvolvimento.

O Jira é utilizado para:

* identificar tarefas pendentes;
* consultar o escopo e os critérios de uma tarefa;
* relacionar alterações realizadas ao issue correspondente;
* atualizar o status da tarefa quando apropriado;
* registrar o tempo efetivamente gasto no desenvolvimento.

### Uso do MCP do Jira

Quando o MCP do Jira estiver disponível, o agente deve consultar o Jira **antes de iniciar uma alteração significativa**, especialmente quando a solicitação envolver uma funcionalidade, correção ou mudança estrutural.

Fluxo recomendado:

1. Identificar o escopo da solicitação recebida.
2. Consultar o Jira por tarefas pendentes relacionadas ao escopo.
3. Verificar:

    * chave do issue;
    * título;
    * descrição;
    * critérios de aceite;
    * status;
    * prioridade;
    * subtarefas;
    * dependências ou issues relacionados.
4. Determinar se a solicitação corresponde a uma tarefa existente.
5. Se existir uma tarefa adequada, utilizá-la como referência durante a implementação.
6. Se não existir uma tarefa adequada, **não inventar uma associação**. Informar que não foi encontrada uma tarefa correspondente e, quando permitido pelo fluxo do projeto, solicitar ou criar uma nova tarefa.
7. Após a implementação, registrar o tempo gasto via worklog e, quando aprovado pelo usuário, um resumo do trabalho no issue.

### Relação entre Jira e o repositório

O Jira **não substitui** a documentação técnica nem o código do projeto como fonte de verdade.

A prioridade das informações é:

1. Código e configurações atuais do projeto;
2. `prisma/schema.prisma` e estrutura real do banco;
3. regras de negócio documentadas;
4. requisitos funcionais e não funcionais;
5. demais documentações técnicas;
6. Jira;
7. histórico da conversa.

O Jira representa principalmente **o trabalho planejado e seu acompanhamento**.

Se a descrição de uma tarefa no Jira entrar em conflito com o código ou com uma regra de negócio documentada, não assumir que o código deve ser alterado automaticamente. Investigar a divergência e solicitar confirmação quando a decisão não estiver definida.

### Consulta de tarefas antes da implementação

Para alterações que possam abranger mais de um arquivo, módulo ou camada da aplicação, consultar o Jira procurando:

* tarefas abertas relacionadas;
* subtarefas da tarefa atual;
* bugs relacionados;
* tarefas bloqueadoras;
* tarefas dependentes;
* tarefas do mesmo Epic;
* tarefas que já estejam implementando parte da mesma funcionalidade.

Evitar criar trabalho duplicado quando já existir uma tarefa correspondente.

### Criar e alterar tasks

O agente **não cria nem altera uma task no Jira por conta própria**.

Antes de criar uma issue — ou de alterar título, descrição ou critérios de aceite de uma
existente — o agente deve **mostrar ao usuário o texto exato** (`summary` e `description`
completos, como vão ficar no Jira) e **aguardar a aprovação**. Só depois da aprovação a
issue é criada ou alterada. Nada é publicado às cegas.

Formato do texto (curto e objetivo — foi o que faltou nas primeiras tasks):

- **summary** — uma linha, começando pelo **resultado** ("Exportação de telas para o
  Figma…"), não pelo processo ("Implementar…"); sem jargão interno.
- **description** — nesta ordem, e sem encher:
  1. **Objetivo** — o que passa a existir, em uma ou duas frases.
  2. **Escopo** — o que entra; o que fica de fora, quando ajudar a delimitar.
  3. **Critérios de aceite** — verificáveis, em lista.
  4. **Referências** — arquivos/regras do repositório que valem para a task.

Não invente escopo, requisito ou critério que não esteja no repositório.

### Comentários em issues

O agente **não deve adicionar comentários automaticamente** a issues do Jira.

Antes de postar qualquer comentário, o agente deve:

1. propor o conteúdo exato do comentário ao usuário;
2. aguardar aprovação;
3. somente então publicar o comentário aprovado.

Isso vale para resumos de trabalho, notas, links e qualquer outra informação. Na dúvida sobre a forma de registrar o andamento, o agente deve perguntar em vez de comentar.

O resumo técnico do trabalho já é preservado no repositório (código, commits e documentação) e não depende de um comentário no Jira para existir.

### Registro de horas

O registro de horas **não é feito como comentário**. Utilizar a operação de **worklog** do MCP (`addOrEditJiraIssueWorklog`), passando `issueIdOrKey` e `timeSpent` (ex.: `1h`, `30m`, `2h 30m`). Uma mensagem `#time` publicada como comentário **não** registra worklog.

Quando o MCP disponibilizar operações de **worklog**, registrar o tempo efetivamente utilizado na tarefa correspondente.

Regras:

* registrar somente tempo efetivamente trabalhado;
* não estimar ou inventar horas;
* não registrar automaticamente tempo apenas porque uma tarefa foi consultada;
* não contabilizar tempo de espera de ferramentas, geração de resposta ou processamento automático como tempo de desenvolvimento;
* quando uma atividade envolver mais de um issue, distribuir o tempo somente quando a divisão for clara;
* se não for possível determinar uma divisão confiável, solicitar orientação antes de registrar o worklog.

O registro de horas deve identificar, quando suportado:

* tempo gasto;
* issue;
* descrição/resumo do trabalho realizado;
* data/hora da atividade.

### Atualização do Jira após alterações

Depois de concluir uma alteração significativa:

1. verificar quais arquivos foram modificados;
2. verificar se os critérios da tarefa foram atendidos;
3. executar as validações pertinentes;
4. registrar o tempo efetivamente gasto via worklog;
5. publicar um resumo objetivo do trabalho no issue **somente após aprovação do usuário** sobre o conteúdo;
6. atualizar o status somente quando a mudança de status representar corretamente o estado real da tarefa.

O agente **não deve marcar uma tarefa como concluída simplesmente porque o código foi alterado**. A conclusão deve refletir os critérios de aceite e as validações do projeto.

### Proteção contra alterações indevidas

O agente não deve:

* mover issues arbitrariamente entre status;
* alterar prioridade sem motivo relacionado ao trabalho;
* modificar critérios de aceite sem autorização;
* fechar/concluir tarefas sem verificar seus critérios;
* criar tarefas duplicadas;
* adicionar comentários em issues sem aprovação prévia do usuário sobre o conteúdo;
* registrar horas que não foram efetivamente trabalhadas;
* registrar horas como comentário (`#time`) em vez de usar a operação de worklog;
* associar uma alteração a uma tarefa apenas por similaridade superficial;
* alterar informações administrativas do Jira sem necessidade para a tarefa atual.

Quando houver dúvida sobre qual issue utilizar, **consultar o Jira e pedir confirmação em vez de assumir**.

### Regra prática

Para uma solicitação de desenvolvimento, o fluxo esperado é:

`Solicitação → Consultar Jira → Identificar issue → Ler escopo → Inspecionar código/docs → Implementar → Validar → Registrar worklog → (Comentar somente com aprovação) → Atualizar status quando aplicável`

O Jira deve acompanhar o trabalho realizado, enquanto o repositório continua sendo a memória técnica persistente do projeto.

### Smart Commits (link automático entre GitHub e Jira)

O repositório utiliza o **GitHub for Atlassian** app para integrar commits, branches e pull requests às tasks do Jira automaticamente.

#### Formato da mensagem de commit

Todo commit relacionado a uma task **deve** incluir a chave do issue no início da mensagem:

```text
KAN-123: descrição do que foi feito
```

#### Smart Commit (ações avançadas)

O Smart Commit permite executar ações no Jira diretamente da mensagem de commit:

| Ação | Formato | Exemplo |
|------|---------|---------|
| Comentar no issue | `KEY #comment <texto>` | `KAN-123 #comment ajuste no cálculo do frete` |
| Transicionar para concluído | `KEY #resolve` ou `KEY #close` | `KAN-123 #resolve` |
| Combinar ações | `KEY #comment <texto>` | `KAN-123 #comment finalizado` |

> **`#time` não é suportado.** O registro de horas deve ser feito pela operação de worklog do MCP (`addOrEditJiraIssueWorklog`), não pela mensagem de commit nem por comentário.

#### Regras

1. **Sempre** incluir a chave do Jira no commit message quando o commit implementar, corrigir ou estiver relacionado a uma task.
2. **Usar a chave no início da mensagem**: `KAN-139: feat: busca priorizada na listagem de produtos`
3. **Branch names** também devem conter a chave quando possível: `KAN-139-modulo-produtos`
4. **Não associar commits a issues errados** apenas por similaridade superficial — confirmar a chave correta antes de commitar.
5. **Não comentar sem aprovação** — qualquer comentário na task deve ser proposto ao usuário e aprovado antes de ser publicado.
6. Registrar o tempo gasto via **worklog do MCP** (`addOrEditJiraIssueWorklog`), conforme as permissões disponíveis.
7. Usar `#resolve` ou `#close` **somente** quando os critérios de aceite da task forem efetivamente atendidos — não automaticamente após qualquer alteração de código.

#### Como o link aparece no Jira

Após o push, o GitHub for Atlassian app processa os Smart Commits e:

- Adiciona o commit à **development panel** do issue no Jira
- Atualiza o **status** se `#resolve` foi usado
- Adiciona **comentário** se `#comment` foi usado
- Registra **worklog** se `#time` foi usado

#### Configuração

A integração GitHub ↔ Jira foi configurada através do app **GitHub for Atlassian** disponível no marketplace do Atlassian. A organização `enzoguinossi/ProjetoFinalFAETEC` está conectada ao site `projeto-final.atlassian.net` com escopo de leitura e escrita nos repositórios do projeto.

### Releases, versões e issues

O versionamento usa **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`). Ao preparar um
release, relacione a versão às issues incluídas (versão de projeto via
`manageJiraProjectVersion`, quando aplicável) e às entradas do `CHANGELOG.md`.

Regras:

- não criar versão/tag oficial sem cumprir o checklist de release
  (`.opencode/skills/release/SKILL.md`) e **sem aprovação do usuário**;
- cada issue incluída na versão deve ter pelo menos um commit associado;
- não registrar horas nem comentar em issues como parte do release sem aprovação prévia.

O fluxo multiagente que conecta Jira, Git, worktrees, DateVer e changelog está em
`docs/agents/WORKFLOW.md`.
