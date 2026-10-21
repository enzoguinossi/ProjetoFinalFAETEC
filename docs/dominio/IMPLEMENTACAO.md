# Implementação — o que já existe no código

> **Este documento descreve o ESTADO ATUAL do sistema**, não a especificação.
> [`REQUISITOS_FUNCIONAIS.md`](REQUISITOS_FUNCIONAIS.md) e
> [`REQUISITOS_NAO_FUNCIONAIS.md`](REQUISITOS_NAO_FUNCIONAIS.md) dizem o que o sistema
> **deve ser**; aqui está o que **já foi construído** — e a evidência de cada linha.
>
> Classificação: **implementado** (existe e é usado), **parcial** (existe em parte ou só em
> testes) e **não implementado** (não há código).

Levantamento conferido por leitura do código em `2026-10-17`, no commit-base `6922050`.
A evidência é o caminho do arquivo que sustenta a classificação — não há resultado fictício.

## Requisitos funcionais

| RF | Status | Evidência (ou ausência) |
| --- | --- | --- |
| RF001 — Usuários, perfis e permissões | implementado | `src/app/usuarios/**`, `src/app/perfis/**`, `src/services/permissao.ts`, `src/dao/usuario.ts`, `src/lib/permissoes.ts` |
| RF002 — Autenticação | implementado | `src/app/login/actions.ts`, `src/app/definir-senha/actions.ts`, `src/app/primeiro-acesso/actions.ts`, `src/lib/auth.ts`, `src/lib/jwt.ts`, `src/proxy.ts` |
| RF003 — Trilha de auditoria | implementado | `src/dao/_audit.ts`; tabela `registro_auditoria` em `prisma/schema.prisma` |
| RF004 — Destinatários | implementado | `src/app/destinatarios/**`, `src/dao/destinatario.ts` |
| RF005 — Funcionários | implementado | `src/app/funcionarios/**` (checkbox de condutor em `FuncionarioForm.tsx`), `src/dao/funcionario.ts` |
| RF006 — Fornecedores | implementado | `src/app/fornecedores/**`, `src/dao/fornecedor.ts` |
| RF007 — Veículos | implementado | `src/app/veiculos/**`, `src/dao/veiculo.ts`, `STATUS_VEICULO` em `src/types/index.ts` |
| *(RF008 não existe — lacuna preservada, ver `REQUISITOS_FUNCIONAIS.md`)* | — | — |
| RF009 — Mural de mensagens | não implementado | Só um cartão **estático** no dashboard (`src/app/dashboard/page.tsx`); sem tela, serviço ou DAO de mural |
| RF010 — Catálogo de produtos | implementado | `src/app/produtos/**`, `src/dao/produto.ts`, `src/components/UnidadesModal.tsx` |
| RF011 — Leitura por código de barras | parcial | Busca priorizada por código em `src/dao/produto.ts` e tipos EAN em `src/dao/tipo-codigo.ts`; **sem** tela/leitor dedicado |
| RF012 — Movimentação de estoque | parcial | `src/dao/estoque.ts` (`movimentar`, `registrarEntrada` e `reservar`); entrada pela aba Entrada (RF017a) atualiza `quantidade_atual` e grava `movimentacao_estoque`; saída pela aba Saída (RF017b) reserva `saldo_reservado` na criação da remessa; **sem** baixa física de remessa e **sem** transferência |
| RF013 — Conversão de unidades | implementado | CRUD em `src/app/unidades/actions.ts`, `src/dao/conversao-unidade.ts` e `src/components/UnidadesModal.tsx`; a entrada calcula `quantidade_convertida = quantidade × fator` com fator editável no formulário (`src/services/nota-entrada.ts`) |
| RF014 — Alertas de validade | não implementado | Nenhuma rotina gera alerta a partir de `produto.data_validade` |
| RF015 — Gestão de inventário | não implementado | Sem código de inventário em `src/app`, `src/services` ou `src/dao` (só as tabelas no schema) |
| RF016 — Baixas por consumo interno e avaria | não implementado | Nenhum fluxo de baixa por consumo/avaria |
| RF017a — Nota de entrada | implementado | Página `/mov-estoque` (aba Entrada) em `src/app/mov-estoque/**`, `src/services/nota-entrada.ts` e `src/dao/nota-entrada.ts`; grava nota (com a chave de acesso opcional na própria `nota_entrada`), itens, estoque, movimentação e auditoria em transação única. A listagem tem ações de visualizar (`nota_entrada.consultar`) e editar (`nota_entrada.alterar`), no mesmo formulário (`mode` create/edit/view): a edição altera cabeçalho, fator/quantidade de item existente e acrescenta itens novos, gerando `movimentacao_estoque` corretiva pelo delta de `quantidade_convertida` e auditoria `NotaEntrada`/`ALTERAR`; remover item e excluir a nota não são permitidos (RN004) |
| RF017b — Nota de saída | implementado | Página `/mov-estoque` (aba Saída) em `src/app/mov-estoque/**`, `src/services/nota-saida.ts` e `src/dao/nota-saida.ts`; a nota `tipo = SAIDA` **não tem itens** e agrega remessas (`EM_PREPARACAO`) com destinatário e itens; grava nota, remessas, itens e reservas (`saldo_reservado += quantidade_solicitada`) em transação única, com auditoria (`NotaSaida`/`CRIAR`); listagem somente leitura (RN004); criar exige `estoque.saida`, ver exige `estoque.ver_saldo` ou `estoque.saida` |
| RF018 — Quadro Kanban de remessas | não implementado | Apenas as constantes `STATUS_REMESSA` (`src/types/index.ts`); **fora do escopo** (`ESCOPO_FORA.md`) |
| RF019 — Assistente de remessa (RN001) | parcial | RN001 implementada em `src/services/estoque.ts` (`verificarDisponibilidade` avisa e não bloqueia) e exposta na aba Saída (saldo disponível por produto + aviso ao exceder, sem bloquear a gravação); **sem** assistente dedicado |
| RF020 — Anexo de fotos | não implementado | Upload existe apenas para foto de produto (`src/lib/imagem.ts`); nada vinculado a remessa |
| RF021 — Pendências e urgências | não implementado | Sem fluxo de pendência/urgência |
| RF022 — Percurso e rota | não implementado | Sem tela/serviço/DAO (só as tabelas no schema) |
| RF023 — Relatórios | não implementado | Item de menu `/relatorios` **sem página** (`src/components/sidebar-config.ts`) |
| RF024 — Exportação de dados | não implementado | Sem geração de PDF/CSV/XLSX |
| RF025 — Importação de NF-e (XML) | não implementado | Sem leitura de XML NF-e — **fora do escopo** (`ESCOPO_FORA.md`) |

## Requisitos não funcionais

| RNF | Status | Evidência (ou ausência) |
| --- | --- | --- |
| RNF001 — Arquitetura web + SGBD | implementado | App Next.js e `prisma/schema.prisma` (`provider = "mysql"`) |
| RNF002 — Desempenho (busca por código < 2 s) | parcial | Busca por código priorizada em `src/dao/produto.ts`; o Kanban saiu do escopo (ver `ESCOPO_FORA.md`); sem medição de tempo |
| RNF003 — Usabilidade | implementado | Telas de cadastro com componentes compartilhados (`src/components/**`, `src/app/**`) |
| RNF004 — Segurança por perfil | implementado | `src/lib/permissoes.ts` e `src/services/permissao.ts`; gating por `entidade.acao` no servidor |
| RNF005 — Backup e integridade | parcial | Integridade referencial pelas FKs do Prisma; **sem** rotina de backup (nenhum script em `scripts/`) |
| RNF006 — Hash de senha (BCrypt) | implementado | `bcryptjs` em `src/app/login/actions.ts`, `src/app/definir-senha/actions.ts` e `src/app/primeiro-acesso/actions.ts` |
| RNF007 — Auditabilidade (snapshots JSON) | implementado | `src/dao/_audit.ts` e as colunas `Json` `dados_anteriores`/`dados_novos` |
| RNF008 — Portabilidade (PDF/CSV/XLSX) | não implementado | Sem exportação em nenhum formato |
| RNF009 — Interoperabilidade (XML NF-e) | não implementado | Sem processamento de XML NF-e |

## Decisões que estavam em aberto

Em **2026-10-19** o usuário decidiu os quatro pontos que este documento registrava como
pendentes — a lista daquela rodada ficou **vazia**. (Pontos surgidos depois das decisões estão
em "Pontos em aberto", abaixo.)

1. **Autor das mensagens automáticas do mural** — `mensagem_mural.ID_usuario` passou a ser
   **opcional**: `NULL` significa "sem autor" e a coluna `automatica` marca o caso
   (`RUN-20261017-08`).
2. **Forma do "registro de pendência" da RN003** — a pendência **é** a remessa com status
   `PENDENTE` criada no split da entrega parcial, vinculada por `remessa.ID_destinatario`;
   **sem tabela nova** (`RUN-20261017-09`; ver `ENTENDIMENTO.md` §3.11.2).
3. **Destino de `anexo.ID_documento_fiscal`** — a coluna órfã foi **removida** do schema, em vez
   de nascer uma entidade fiscal (`RUN-20261017-08`).
4. **Enforcement de `tipo_codigo`** — a ausência de permissões é **intencional**: é dado de
   referência sem operação de escrita para autorizar (`RUN-20261017-09`; ver
   `ENTENDIMENTO.md` §3.15.6).

## Pontos em aberto

- **Como um pedido entra numa nota de saída** — a decisão do usuário de **2026-10-19** definiu
  **que** a nota consolida pedidos (o vínculo é `pedido_escola.ID_nota_saida`, 1:N), mas **não**
  definiu **quando** o pedido é consolidado: **criar uma nota nova a cada pedido confirmado** ou
  **juntar o pedido a uma nota já aberta** (por exemplo, a do mesmo destinatário). O fluxo manual
  de nota de saída com remessas planejadas foi implementado (RF017b), mas o **pedido** ainda não
  entra nele: a consolidação pedido → nota continua em aberto, para o módulo de expedições
  (KAN-142 / RF017b). (`RUN-20261017-11`; RF017b implementada em `RUN-20261019-15`.)

