# `.ai-workflow` — estado persistente do trabalho multiagente

Este diretório é a **memória persistente** do fluxo de desenvolvimento orquestrado
por agentes. Ele existe para que uma sessão (incluindo o Orquestrador) consiga
**reconstruir o estado real** do trabalho depois de compactação de contexto,
reinicialização de sessão ou falha de um agente — **sem depender do histórico da
conversa**.

> Fonte de verdade do projeto (código, `prisma/schema.prisma`, `docs/`, `AGENTS.md`,
> `docs/agents/JIRA.MD`) continua tendo prioridade sobre qualquer relatório de agente.
> Um relatório de agente **não é prova** de que uma operação de Git ou Jira aconteceu.

## Estrutura

```text
.ai-workflow/
├── README.md                 # este arquivo (regras de uso e propriedade)
├── PROJECT_STATE.md          # estado corrente consolidado (1 por projeto)
├── contracts/
│   └── TASK_CONTRACT_TEMPLATE.md   # template do contrato de tarefa
├── runs/
│   └── RUN-<AAAAMMDD>-<NN>-<slug>.md   # 1 arquivo por execução (contrato + resultado)
├── decisions/
│   └── NNNN-<slug>.md        # ADRs (decisões arquiteturais)
└── ARCHITECTURE_TESTS.md     # procedimento de validação da própria arquitetura
```

## Regras de escrita (evitar concorrência)

- **`PROJECT_STATE.md` tem um único escritor: o Orquestrador.** Nenhum subagente
  escreve nele diretamente; o subagente reporta e o Orquestrador consolida.
- **Cada `runs/*.md` pertence a um único agente/execução.** Um agente escreve
  apenas o próprio arquivo de run. Dois agentes nunca editam o mesmo arquivo.
- **`decisions/` é append-only.** Uma decisão não é reescrita; ela é superada por
  uma nova ADR que a referencia.
- Antes de iniciar uma execução, o Orquestrador **valida o estado real do Git**
  (`git status`, `git worktree list`, branch/commit atual) e só então atualiza o estado.

## Como retomar o trabalho após compactação/reinício

1. Ler `PROJECT_STATE.md` (objetivo, runs ativos, bloqueios, próximo passo).
2. Rodar `git status --porcelain=v1 -b` e `git worktree list` no diretório do projeto.
3. Para cada run ativo, ler `runs/<run-id>.md` (contrato + último resultado).
4. Conferir se o que está no estado bate com o Git real; **divergência → o Git vence**.
5. Retomar a partir do "Próximo passo" registrado.
