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
├── schema.prisma   # modelo físico (48 entidades)
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

O seed de referência (`prisma/seed.ts` + `npm run db:seed`) é o único usado em produção. O
**seed de demonstração** (`prisma/seed-demo.ts` + `npm run db:seed:demo`) é **exclusivo do
banco de desenvolvimento `nexus`**, é aditivo/idempotente e recusa `nexus_prod`/produção;
nunca o inclua no `db:setup`/release.

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
* o saldo de estoque **não é entidade própria**: fica em `produto.saldo` e
  `produto.saldo_reservado` (default `0`). Não existe tabela `estoque`, linha de estoque
  nem lote; a data de entrada fica no histórico de movimentações e a atividade é
  `produto.ativo`.
* **Exceções (sem `ativo`, exclusão física):** `conversao_unidade` e `percurso` são
  excluídos fisicamente e não possuem `ativo`; as demais entidades de cadastro continuam
  com desativação (`ativo = false`). A unidade **padrão** do sistema (UNIDADE/1) é a
  exceção dentro da exceção: não pode ser excluída nem ter nome ou fator alterados
  — só a descrição é editável. Ao excluir uma unidade que não é a padrão, os produtos
  que a usavam são revinculados à unidade padrão **nos dois vínculos** — Conversão Padrão
  de Entrada (`ID_conversao_padrao`) e Unidade Padrão de Saída (`ID_conversao_saida`) —,
  com auditoria dos totais.

Preserve as convenções existentes do projeto.

Não introduza uma convenção nova apenas por preferência pessoal.

---

# 8. Integridade do estoque

O estoque é uma área crítica do sistema.

**O saldo é do produto.** Não existe tabela `estoque` nem linha de estoque/lote: o saldo
mora em `produto.saldo` e `produto.saldo_reservado`, ambos `FLOAT NOT NULL DEFAULT 0`.
Todo produto tem saldo desde a criação (zero). O modelo diferencia:

```text
produto.saldo
produto.saldo_reservado
saldo_disponivel
```

A regra é:

```text
saldo_disponivel = saldo - saldo_reservado
```

Todas as quantidades de estoque — `saldo`, `saldo_reservado`, movimentação, reserva e baixa
— estão em **base** (`UNIDADE`, fator 1). A conversão de unidade é **apenas auxílio de
lançamento**: calcula o total na hora e não é copiada para a nota. Dashboard, relatórios,
listagens e seletores exibem a quantidade **sem o nome da unidade**.

A antiga tabela `estoque` foi achatada em `produto` (RUN-20261026-80): a migração consolidou
as linhas **ativas** por produto (`saldo = SUM(quantidade_atual)`,
`saldo_reservado = SUM(saldo_reservado)`), deu zero aos produtos sem linha e remapeou os
registros históricos de `ID_estoque` para `ID_produto`. `data_entrada` e `estoque.ativo` não
existem mais; a data fica nas movimentações e a atividade é `produto.ativo`.

## 8.1 Entrada

Uma entrada confirmada:

```text
produto.saldo += quantidade
```

em que `item_nota_entrada.quantidade` é o **total** que entra no saldo. No item novo, a
Conversão Padrão de Entrada do produto (`ID_conversao_padrao`) e um fator editável na tela
servem de auxílio para calcular esse total; o item já gravado é editado pelo total guardado.
A nota não guarda fator nem unidade. Gera também a `movimentacao_estoque` com `ID_produto`,
`saldo_anterior` e `saldo_posterior`.

## 8.2 Reserva (nota de saída Remessa)

Criar uma **nota de saída do tipo Remessa (`SAIDA`) com itens e destinatário** reserva saldo:

```text
produto.saldo_reservado += quantidade
```

A reserva pertence **à nota de saída** — não existe mais um nível intermediário de remessa
nem linha de estoque por item (`item_nota_saida` referencia `ID_produto`). Criar a nota também
não representa baixa física definitiva.

Na Remessa, a Unidade Padrão de Saída do produto (`produto.ID_conversao_saida`) é **auxílio
do item novo**: a tela mostra unidade e fator e calcula `qtd_esperada = quantidade × fator`.
A nota guarda **só o total** (`qtd_esperada` solicitado, `qtd_entregue` entregue) — sem
unidade, fator ou quantidade “na unidade”. O item já gravado é editado pelo total guardado.
Reserva, baixa, entrega e pendência usam esses totais.

**Avaria (`AVARIA`) e Consumo Interno (`CONSUMO_INTERNO`)** não são remessa: não têm destinatário,
**não reservam** e dão **baixa real na criação** (`produto.saldo -= quantidade`, com movimentação
negativa e `ID_nota_saida`); a nota nasce `BAIXA_TOTAL`, com `qtd_entregue = qtd_esperada`. A
reserva acima vale apenas para Remessa. Avaria e Consumo Interno digitam o **total** direto, sem
auxílio de unidade.

## 8.3 Cancelamento

O cancelamento da **nota de saída em Remessa** libera a reserva:

```text
produto.saldo_reservado -= quantidade
```

A nota vai para `CANCELADA` e permanece no histórico (RN004); cancelar de novo é recusado
sem debitar a reserva outra vez. Notas de Avaria/Consumo Interno já baixadas não são canceláveis —
são histórico; a correção é uma nota nova.

## 8.4 Nota baixada

A baixa definitiva ocorre quando a entrega da nota é finalizada:

```text
produto.saldo -= quantidade_entregue
produto.saldo_reservado -= quantidade_entregue
```

Qualquer implementação relacionada a estoque deve preservar essa distinção. A baixa não é
bloqueada por saldo insuficiente (RN001), mas nunca deixa `saldo_reservado` negativo; a
`movimentacao_estoque` registra o `saldo_anterior`/`saldo_posterior` por `ID_produto`.

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

ABERTO / EM_CONTAGEM / AGUARDANDO_APROVACAO → CANCELADO
```

Regras importantes:

* o snapshot de `quantidade_sistema` é `produto.saldo` na abertura e deve ser preservado;
* um produto não pode estar em dois inventários ativos (ABERTO/EM_CONTAGEM/
  AGUARDANDO_APROVACAO); abertura/edição travam os produtos (`SELECT ... FOR UPDATE`) antes
  da checagem;
* decisão, finalização e cancelamento são transacionais, travam a linha do inventário e não
  ajustam em CANCELADO/FINALIZADO;
* o bloqueio é **por produto** enquanto o inventário está ABERTO, EM_CONTAGEM ou
  AGUARDANDO_APROVACAO — entrada, saída, reserva, liberação, baixa, baixa direta,
  desmontagem e coleta;
* a exceção é a movimentação de ajuste do próprio inventário;
* uma contagem por funcionário/item; item sem contagem bloqueia o fechamento;
* contagem cega é funcional: com `Inventario.contagem_cega = true`, só `estoque.ver_saldo`
  vê sistema/saldos; com `false`, todos veem. Não existe `inventario.ver_contagem_cega`;
* a decisão fica em `ItemInventario` (`quantidade_final`, `origem` MEDIA/CONTAGEM,
  `id_contagem_inventario`, `decidido_em`, `id_usuario_decisao`); o aprovador pode escolher a
  média ou qualquer contagem individual, mesmo sem diferença;
* `AjusteInventario` (`quantidade_contada`, sem `diferenca`) só é criado quando o valor
  escolhido difere do sistema e é único por inventário/produto; sem diferença, o item fica
  decidido e o inventário pode finalizar;
* aprovação altera `produto.saldo` e gera `movimentacao_estoque` com
  `id_ajuste_inventario`; rejeição não altera o saldo; o ajuste não mexe em
  `saldo_reservado`;
* cancelamento só é permitido em ABERTO/EM_CONTAGEM/AGUARDANDO_APROVACAO e enquanto não
  houver ajuste aprovado/movimento; grava `data_fim`;
* edição só em ABERTO e sem contagens; exclusão só sem contagens/ajustes; com contagem ou
  ajuste, só cancelar (preservando contagens, ajustes e auditoria);
* finalizado/cancelado continua consultável; `FINALIZADO` não volta;
* edição/exclusão registram auditoria com produto, quantidade e saldo (não só IDs);
* permissões: `inventario.abrir`, `inventario.contar`, `inventario.aprovar_ajuste`; lista
  impressa e relatório CSV/PDF exigem `relatorio.gerar`; na cega, sistema/saldos,
  `quantidade_final` e a inferência de “sem ajuste/igual” exigem também `estoque.ver_saldo`
  (tela, lista e CSV mascaram/omitem);
* produto com item/ajuste de inventário não pode ser excluído (hard delete protegido).

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
`ativo`** — a exclusão é permanente e o snapshot anterior fica na auditoria. A unidade
**padrão** (`padrao = true`, UNIDADE/1) **não pode ser excluída** nem ter nome ou
fator alterados; ao excluir uma unidade que não é a padrão, os produtos que a usavam são
**revinculados à unidade padrão nos dois campos** (`ID_conversao_padrao` e
`ID_conversao_saida`), com o total na auditoria. As demais
entidades de cadastro continuam com desativação.

Históricos operacionais e registros de auditoria devem permanecer preservados.

O saldo não é uma entidade de cadastro e **não tem `ativo`**: `produto.saldo`/
`produto.saldo_reservado` são valores correntes do produto, e a desativação do produto não
apaga nem o saldo nem o histórico (`movimentacao_estoque`/`reserva_estoque` continuam por
`ID_produto`, com `saldo_anterior`/`saldo_posterior`). Não existe mais `estoque.ativo`.

O **pedido** (`pedido_escola`) também **não tem `ativo`** e não é desativado nem excluído: o
histórico é o status (`PENDENTE`/`CONFIRMADO`/`RECUSADO`). Não crie `ativo`, desativação ou
exclusão para pedidos.

O **anexo** (`anexo`) tem `ativo` e é **desativado** com auditoria. Exclusão física só
acontece por **cascade** quando o dono é excluído (`id_produto`/`id_funcionario`/
`id_expedicao_nota`). Não apague arquivo do disco antes do commit. Ver §14.2.

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

A Remessa usa a **Unidade Padrão de Saída** apenas como auxílio no item novo; a nota guarda
só `qtd_esperada` e `qtd_entregue` (totais). A expedição, a baixa e a pendência trabalham com
esses totais e exibem apenas quantidades, sem unidade, fator ou “base”; a reserva e a baixa
mexem em `produto.saldo_reservado` e `produto.saldo` (o item referencia `ID_produto`, não há
linha de estoque). A entrada segue a mesma regra: `quantidade` é o total. Avaria e Consumo
Interno digitam o total.

Não implemente um novo fluxo de entrega sem verificar:

* `produto.saldo` e `produto.saldo_reservado`;
* `nota_saida`;
* `item_nota_saida` (`ID_produto`);
* `reserva_estoque` e `movimentacao_estoque` (`ID_produto`);
* `expedicao`;
* `expedicao_nota` (tentativa: `justificativa`, `data_tentativa`, `ID_usuario_tentativa`);
* `anexo` com `ID_expedicao_nota` (fotos da tentativa);
* `coleta` (`item_coleta` por `ID_produto`).

## 14.1 Pedidos (RF025)

O **pedido** é somente a solicitação: não reserva estoque e não movimenta saldo. Fica em
`/pedidos`, acessível por **qualquer** permissão do módulo (`listar/consultar/criar/alterar/
aprovar`), com as ações exibidas conforme a permissão; não tem número nem **`ativo`** (não se
desativa nem exclui; o histórico é `PENDENTE`/`CONFIRMADO`/`RECUSADO`), e `data_criacao` é
automática. Só `PENDENTE` é editável; editar exige `pedido.alterar`, aprovar/recusar exige
`pedido.aprovar`, e as transições são condicionais (`WHERE status = PENDENTE`), com auditoria.

Os itens guardam **só o total** e a **observação por item** (visível no formulário/detalhe e
copiada para a nota); a Unidade Padrão de Saída é auxílio de preenchimento (sem vínculo/fator)
e produtos repetidos **somam**. Aprovar **não cria nota**: o pedido `CONFIRMADO` sem nota
aparece na importação da Saída. A importação usa `pedidoService.importar` (não o formulário
comum), exige `nota_saida.criar`, mostra destinatário/itens somente leitura, cria **uma nota
nova por pedido** (1:1), valida destinatário/produtos/quantidades e **recusa nota divergente**,
aplica RN001 e o bloqueio por inventário, e grava `pedido.ID_nota_saida` na mesma transação.
Nenhuma nota de entrada ou saída aceita produto duplicado (`@@unique` + serviço).

Lista e relatório (`/relatorios/pedidos`) filtram por escola, status, período, produto e
**Nota com/sem/todas**; o relatório usa o layout ampliado A4 paisagem e CSV. **O módulo de
Pedidos não usa Figma/`data-figma`** (decisão do usuário).

No release de produção, antes do `db push` das uniques, rode `npm run db:dedupe-notas`
(`scripts/dedupe-itens-nota.ts`) **com a URL explícita do banco**: o script não lê o `.env`.
Use `DATABASE_URL="mysql://..." npm run db:dedupe-notas` para o dry-run (padrão) e
`DATABASE_URL="mysql://..." npm run db:dedupe-notas -- --apply` para aplicar; `--apply` só
aceita o banco `nexus_prod` (ou um banco de teste, com "test" no nome), grava backup JSON e
auditoria e consolida os itens duplicados. Também é possível passar `--url "mysql://..."` em
vez da variável de ambiente.

## 14.2 Tentativa de entrega e fotos

A **tentativa** é registrada no vínculo `expedicao_nota`, não na nota:

* **Entrega parcial** — o formulário lista **só itens com pendência** e os completos ficam em
  bloco somente leitura. O campo **“entregar agora”** recebe o **delta** (default = pendência;
  `0` desmarca) e o servidor grava `qtd_entregue = atual + delta`. O servidor **recusa** item
  sem pendência, redução do já entregue, item de outra nota e delta zero em todos os itens sem
  corte e sem justificativa.
* **Não entregue** — exige `justificativa` (1..1000 caracteres) e mantém a nota em `PENDENTE`
  com a reserva intacta; grava `data_tentativa` e `ID_usuario_tentativa`.
* **Fotos** — 0..5 por tentativa. Depois de registrada, a tentativa é **imutável**: não remova,
  troque nem desative as fotos de uma tentativa gravada; uma nova tentativa é outro vínculo.
* A nota de saída exibe as tentativas em modo somente leitura (data, usuário, justificativa e
  fotos).

**Fotos do cadastro** (produto e funcionário) seguem outra regra: **no máximo 1 anexo ativo**.
Trocar a foto desativa o anterior e o arquivo antigo do disco só sai **depois do commit**. Use
`FotosField`/`FotosGaleria` (§17) e `anexoService`/`anexoDAO` — não crie coluna `foto_url`.

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

* entrada de estoque (atualização de `produto.saldo`);
* reserva/liberação de estoque (`produto.saldo_reservado`);
* baixa de remessa (produto + reserva);
* correção de notas;
* ajustes de inventário;
* desmontagem de produtos compostos;
* operações que alteram saldo do produto + auditoria.

Uma operação não deve deixar o banco em estado parcialmente atualizado.

Ao implementar uma operação de estoque, pense sempre no conjunto:

```text
registro operacional
+
produto.saldo / produto.saldo_reservado
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

**Desktop only:** o sistema é usado em desktop, com resolução mínima **1360×768**. Não
desenvolva, teste nem tire screenshots em viewport mobile; não adicione breakpoints novos
(`sm:`/`md:`) para telas pequenas. O layout usa a largura disponível (sidebar de 256px;
conteúdo ≥ 1104px) e pode rolar verticalmente dentro do modal.

**Fotos:** use os componentes compartilhados `FotosField` (edição: upload, URL externa no
cadastro, limite `max` e remoção via `remover_anexos`) e `FotosGaleria` (visualização
somente leitura). Não crie um campo de foto por tela nem duplique a lógica de processamento —
o WEBP/limite é do servidor (`src/lib/imagem.ts`). O input de arquivo aceita seleção múltipla
apenas quando `max > 1`.

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
