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
7. Após a implementação, registrar no issue o trabalho realizado e o tempo gasto, conforme as permissões disponíveis no MCP.

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

### Registro de horas

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
4. registrar um resumo objetivo do trabalho realizado no issue, quando apropriado;
5. registrar o tempo efetivamente gasto;
6. atualizar o status somente quando a mudança de status representar corretamente o estado real da tarefa.

O agente **não deve marcar uma tarefa como concluída simplesmente porque o código foi alterado**. A conclusão deve refletir os critérios de aceite e as validações do projeto.

### Proteção contra alterações indevidas

O agente não deve:

* mover issues arbitrariamente entre status;
* alterar prioridade sem motivo relacionado ao trabalho;
* modificar critérios de aceite sem autorização;
* fechar/concluir tarefas sem verificar seus critérios;
* criar tarefas duplicadas;
* registrar horas que não foram efetivamente trabalhadas;
* associar uma alteração a uma tarefa apenas por similaridade superficial;
* alterar informações administrativas do Jira sem necessidade para a tarefa atual.

Quando houver dúvida sobre qual issue utilizar, **consultar o Jira e pedir confirmação em vez de assumir**.

### Regra prática

Para uma solicitação de desenvolvimento, o fluxo esperado é:

`Solicitação → Consultar Jira → Identificar issue → Ler escopo → Inspecionar código/docs → Implementar → Validar → Atualizar Jira → Registrar worklog`

O Jira deve acompanhar o trabalho realizado, enquanto o repositório continua sendo a memória técnica persistente do projeto.
