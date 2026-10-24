# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

A convenção completa — como numerar releases do mesmo dia, como escrever uma entrada e a
rastreabilidade versão ↔ issues ↔ commit — está em
[`docs/processo/VERSIONAMENTO.md`](docs/processo/VERSIONAMENTO.md). O checklist de release está em
`.opencode/skills/release/SKILL.md`.

## [Unreleased]

### Added

- **Módulo de Relatórios e Lista de Produtos `(KAN-159)`:** novo hub `/relatorios` (cards; os
  demais relatórios como "em breve") e a tela `/relatorios/produtos`, com filtros aplicados no
  servidor (busca por código/descrição e situação ativas/inativas/todas) e permissão
  `relatorio.gerar`. O relatório usa o layout A4 de `docs/relatorios/` (`Produtos.html` +
  `Relatorio.css`), com cabeçalho de emissão, tabela Código/Descrição/Unidade/Quantidade/
  Qtd. Livre/Situação, totalizadores e rodapé com o emissor; a impressão (`window.print()`)
  esconde sidebar e AppBar pelas marcas `data-print-hide` do `DashboardLayout`. O CSV em
  `/relatorios/produtos/export` repete os filtros, com BOM UTF-8, separador `;` e decimal com
  vírgula (RF024). DAO/serviço em `src/dao/relatorio.ts` e `src/services/relatorio.ts`; os
  templates de `docs/relatorios/` foram corrigidos (CSS, nome do arquivo/README e colunas sem
  origem no modelo). Testes em `tests/dao/relatorio.test.ts` e
  `tests/services/relatorio.test.ts`.
- **Expedição com data prevista, veículo e condutor obrigatórios `(KAN-140)`:** `expedicao.data_prevista`,
  `ID_veiculo` e `ID_funcionario_condutor` passaram a **`NOT NULL`**, e as relações `veiculo` e
  `condutor` deixaram de ser opcionais. O formulário de criação inicia a data com o dia atual
  (fuso `America/Sao_Paulo`, helper `hojeISO` em `src/lib/formatar.ts`, sem `toISOString` puro)
  e os dois selects não têm mais "Sem veículo"/"Sem condutor". O serviço recusa sem veículo
  ("Selecione o veículo.") ou sem condutor ("Selecione o condutor."), e o DAO exige veículo ativo
  e funcionário ativo com `condutor = true` na criação e na alteração (não é possível limpar os
  vínculos). A migração sem reset preencheu as linhas existentes (data = data de criação; condutor
  = único condutor ativo). Código em `prisma/schema.prisma`, `src/services/expedicao.ts`,
  `src/dao/expedicao.ts`, `src/app/expedicoes/**` e `src/lib/formatar.ts`; testes em
  `tests/services/expedicao.test.ts` e `tests/helpers/factories.ts`.
- **Unidade padrão do sistema e unidade obrigatória no produto `(KAN-140)`:** a `UNIDADE`
  (fator 1) passou a ser a unidade **padrão** do sistema. `conversao_unidade` ganhou
  `padrao` (exatamente uma `TRUE`), e `produto.ID_conversao_padrao` deixou
  de ser nullable: o cadastro sempre grava uma unidade — a padrão quando o formulário não
  informa. A unidade padrão não pode ser excluída nem ter nome ou fator alterados
  (só a descrição), e ao excluir uma unidade que não é a padrão os produtos que a usavam
  são revinculados à unidade padrão (a exclusão não é recusada por uso). O nome da unidade
  (`UNIDADE`, `PACOTE`, `CAIXA`) é a forma exibida nas telas compactas —
  `src/lib/produto-linha.ts`, seletor de produto e itens de entrada/saída — e o select mostra
  apenas o nome. O seed ficou idempotente e garante a invariante, e a migração dos dados
  existentes (padrão e backfill do produto) roda sem reset. Código em
  `prisma/schema.prisma`, `prisma/seed.ts`, `src/dao/conversao-unidade.ts`,
  `src/dao/produto.ts`, `src/app/unidades/actions.ts`, `src/app/produtos/**`,
  `src/app/mov-estoque/**` e `src/components/UnidadesModal.tsx`; testes em
  `tests/dao/conversao-unidade.test.ts`, `tests/dao/produto.test.ts` e
  `tests/lib/produto-linha.test.ts`.
- **Tipo de Saída com avaria e consumo interno `(KAN-140)`:** o formulário de saída ganhou **Tipo de
  Saída** (Remessa / Avaria / Consumo Interno) e itens inline no formato do ERP
  (Código/Descrição/Unidade/Quantidade), sem campos de valor. Remessa (`SAIDA`) mantém destinatário
  obrigatório, urgência, reserva (`saldo_reservado += qtd`) e status `ABERTA`. Avaria (`AVARIA`) e
  Consumo Interno (`CONSUMO_INTERNO`) não têm destinatário, não reservam e dão **baixa real na
  criação**: `quantidade_atual -= qtd` e `movimentacao_estoque` negativa com `ID_nota_saida`, nota em
  `BAIXA_TOTAL` e `qtd_entregue = qtd_esperada`. RN001 continua apenas avisando (o saldo pode ficar
  negativo) e a auditoria `NotaSaida`/`CRIAR` guarda tipo, itens, saldos e movimentações. Notas de
  avaria/consumo são histórico: não são editáveis nem canceláveis. A listagem passou a mostrar todos
  os tipos, com a coluna **Tipo** e destinatário `—` quando não há pessoa. Código em
  `src/dao/estoque.ts` (`baixarDireto`), `src/dao/nota-saida.ts`, `src/services/nota-saida.ts`,
  `src/app/mov-estoque/**`, `src/lib/produto-linha.ts` e `src/components/SearchEntityModal.tsx`
  (`initialSearch`); testes em `tests/services/nota-saida.test.ts` e `tests/lib/produto-linha.test.ts`.
- **Execução da entrega e baixa da nota `(KAN-140)`:** dentro da expedição em percurso, cada nota
  ganhou **Registrar entrega** (modal por item com esperada, já entregue, entrega total e o
  interruptor **cortar o restante**) e o atalho **Não entregue**; o cabeçalho ganhou **Concluir
  expedição**. A baixa roda em transação única: `quantidade_atual` e `saldo_reservado` caem pelo
  delta entregue, `item_nota_saida.qtd_entregue` é atualizado e `movimentacao_estoque` é gravada
  com quantidade negativa e `ID_nota_saida`; o corte libera o restante via reserva negativa, sem
  movimentação. Status: tudo entregue `BAIXA_TOTAL`; parcial com restante `BAIXA_PARCIAL` (reserva
  mantida, nota elegível a outra expedição); parcial com corte `BAIXA_COM_CORTE`; tentativa sem
  entrega `PENDENTE`. A segunda baixa é recusada pela transição condicional de status, e a
  conclusão marca as notas ainda em percurso como `PENDENTE`, conclui a expedição e devolve o
  veículo para `DISPONIVEL`. `saldo_reservado` nunca fica negativo (RN001 não bloqueia pela
  `quantidade_atual`). Código em `src/dao/estoque.ts` (`baixar`), `src/dao/expedicao.ts`,
  `src/services/expedicao.ts`, `src/app/expedicoes/[id]/**` e `actions.ts`; testes em
  `tests/services/expedicao.test.ts`.
- **CRUD de percursos de expedição `(KAN-140)`:** nova tela `/expedicoes/percursos`
  (grupo **Expedições** na sidebar, padrão do grupo Cadastros) para cadastrar os templates
  ordenados de visitas que as expedições usarão como base. A listagem mostra nome e quantidade de
  destinatários, com ações de visualizar, editar e excluir. O formulário exige
  nome (único entre todos os percursos) e ao menos um destinatário, sem repetição; a ordem
  das visitas é editável por setas e gravada em `ordem_visita` contínua a partir de 1. A
  exclusão é **física** — o registro e as visitas são apagados e a auditoria guarda o
  snapshot anterior. DAO, serviço e actions ficam em `src/dao/percurso.ts`,
  `src/services/percurso.ts` e `src/app/expedicoes/percursos/actions.ts`; criar, alterar e
  excluir gravam auditoria (`Percurso`) e as permissões `percurso.*` são validadas no
  servidor. O seletor de destinatários tem listagem própria (não depende de
  `estoque.saida`). Testes em `tests/services/percurso.test.ts`.
- **Base do módulo de expedições `(KAN-140)`:** a `expedicao` ganhou **status próprio** —
  `enum StatusExpedicao { PLANEJADA, EM_PERCURSO, CONCLUIDA }` no schema, com
  `status StatusExpedicao @default(PLANEJADA)` em `Expedicao` (a expedição nasce planejada) e
  a constante `STATUS_EXPEDICAO`/tipo `StatusExpedicao` em `src/types/index.ts`. O seed passou
  a criar as permissões de `percurso` (`listar`, `criar`, `alterar`, `consultar`, `excluir`) e
  de `expedicao` (`listar`, `criar`, `alterar`, `consultar`, `desativar`), levando o catálogo
  de **70 para 80**. DER, `classes.puml` e `ENTENDIMENTO.md` (§3.10 e §3.15.1) refletem o
  status e as novas permissões. Telas, DAOs, serviços e actions vêm nos runs seguintes.
- **Visualização e edição da nota de saída e da remessa `(KAN-140):** a listagem de
  `/mov-estoque` (aba Saída) ganhou a coluna de ações com visualizar
  (`nota_saida.consultar`) e editar (`nota_saida.alterar`) da nota, e cada remessa da
  expansão ganhou visualizar (`remessa.consultar`) e editar (`remessa.alterar`) ao lado do
  cancelamento — todas validadas no servidor. O `RemessaForm` (`mode` view/edit) mostra
  destinatário, condutor, veículo, urgência, observação, status e os itens com
  solicitada/separada/entregue; a criação continua no `SaidaForm`. A remessa só é editável
  em `EM_PREPARACAO` ou `PRONTO_PARA_ENTREGA` — finalizada ou cancelada é histórico
  (RN004) e a edição é recusada. Em transação única, cada item alterado corrige a reserva
  **pelo delta** (`nova_solicitada − antiga`): `estoque.saldo_reservado += delta` e uma
  `reserva_estoque` com `quantidade = delta` (positiva ou negativa) e os saldos
  anterior/posterior; item novo reserva o valor cheio, e a operação grava auditoria
  (`Remessa`/`ALTERAR`). A nota de saída é editada apenas na observação
  (`NotaSaida`/`ALTERAR`) — as remessas são editadas individualmente, cada uma com a sua
  reserva. **Remover item não é permitido** (não há estado de item excluído — RN004); a UI
  não oferece a ação e o serviço/DAO recusam. Qualquer falha desfaz tudo.
- **Visualização e edição da nota de entrada `(KAN-140)`:** a listagem de
  `/mov-estoque` (aba Entrada) ganhou a coluna de ações com visualizar
  (`nota_entrada.consultar`) e editar (`nota_entrada.alterar`, validados no
  servidor). Os dois modais reutilizam o `EntradaForm` (`mode` create/edit/view),
  sem duplicar o formulário; no modo `view` tudo é somente leitura. A edição altera
  fornecedor, data de recebimento, observação e chave, permite corrigir
  fator/quantidade de um item existente e **acrescentar** itens novos, em uma única
  transação: cada item alterado gera `movimentacao_estoque` com
  `quantidade = convertida_nova − convertida_antiga` (positiva ou negativa) e os
  saldos anterior/posterior, item novo entra pela convertida cheia e a operação
  grava auditoria (`NotaEntrada`/`ALTERAR`) com antes/depois. Qualquer falha desfaz
  tudo. **Remover item não é permitido** — não há estado de "item excluído" e
  apagar a linha perderia a rastreabilidade (RN004); a UI não oferece a ação e o
  serviço/DAO recusam. Excluir a nota continua fora do escopo.
- **Permissões de remessa para consulta e edição `(KAN-140)`:** o seed passa a criar
  `remessa.consultar` e `remessa.alterar` ao lado das já existentes `remessa.criar`,
  `remessa.alterar_status` e `remessa.finalizar`, permitindo autorizar a leitura e a edição
  de uma remessa (`entidade.acao`). Total de permissões do seed: **68 → 70**, sem duplicatas.
  Aplicado no banco com `npm run db:seed` (upsert idempotente); documentação de permissões
  atualizada em `docs/dominio/ENTENDIMENTO.md` §3.15.1.
- **Cancelamento de remessa com liberação da reserva `(KAN-140)`:** `StatusRemessa` ganhou
  `CANCELADA` (ao final do enum) e a aba Saída permite cancelar uma remessa pelo detalhe da
  nota. Só remessas em `EM_PREPARACAO` ou `PRONTO_PARA_ENTREGA` podem ser canceladas; em
  percurso ou finalizadas a ação é recusada com mensagem clara. Em transação única, cada item
  devolve `saldo_reservado -= quantidade_solicitada`, registra uma `reserva_estoque` com
  quantidade negativa (saldos anterior/posterior e data/hora), muda a remessa para `CANCELADA`
  e grava auditoria (`Remessa`/`ALTERAR`). Cancelar de novo é recusado e nada é excluído
  (RN004). Ação exige `remessa.alterar_status` no servidor.
- **Aba Saída da movimentação de estoque `(KAN-140)`:** nova aba em `/mov-estoque` que cria a
  nota de saída (`tipo = SAIDA`, `status = ABERTA`) agregando uma ou mais **remessas
  planejadas**. A nota **não tem itens**: destinatário, condutor (só `funcionario.condutor`),
  veículo, urgência e itens ficam na remessa (`status = EM_PREPARACAO`). A gravação é uma
  transação única: `nota_saida`, `remessa`, `item_remessa`, reserva de estoque
  (`saldo_reservado += quantidade_solicitada` + `reserva_estoque` apontando para a remessa) e
  auditoria (`NotaSaida`/`CRIAR`). Saldo insuficiente apenas avisa e **não bloqueia** (RN001),
  com o disponível exibido por produto. Criar exige `estoque.saida`; ver exige
  `estoque.ver_saldo` ou `estoque.saida`; a listagem é somente leitura (RN004). Código em
  `src/app/mov-estoque/**`, `src/services/nota-saida.ts`, `src/dao/nota-saida.ts` e
  `estoqueDAO.reservar`.
- **Aba Entrada da movimentação de estoque `(KAN-140)`:** nova página `/mov-estoque` (aba
  Entrada; a aba Saída foi implementada no run seguinte). O formulário aceita fornecedor e data de
  recebimento opcionais, chaves de acesso NF-e opcionais (44 caracteres, únicas), observação e
  itens com conversão de unidade de fator editável. A gravação é uma transação única:
  `nota_entrada`, `nota_entrada_chave_acesso`, `item_nota_entrada`, atualização de
  `estoque.quantidade_atual` (uma linha por produto), `movimentacao_estoque` e auditoria
  (`NotaEntrada`/`CRIAR`). Criar exige `estoque.entrada`; a entrada confirmada é imutável
  (RN004) e a listagem é somente leitura. Código em `src/app/mov-estoque/**`,
  `src/services/nota-entrada.ts`, `src/dao/nota-entrada.ts` e `estoqueDAO.registrarEntrada`.

### Changed

- **Nota de saída e remessa fundidas em um só nível `(KAN-140)`:** por decisão do usuário de
  2026-10-23, a **nota de saída** passou a ser a própria entrega — carrega destinatário, itens,
  reserva e status — e a **expedição** virou o manifesto (veículo, condutor e ordem das notas).
  Saíram do schema `Remessa`, `ItemRemessa` e o enum `StatusRemessa`; `StatusNotaSaida` agora é
  `ABERTA`, `EM_PERCURSO`, `PENDENTE`, `BAIXA_TOTAL`, `BAIXA_PARCIAL`, `BAIXA_COM_CORTE` e
  `CANCELADA`. `NotaSaida` ganhou `ID_destinatario` (obrigatório para `SAIDA` na camada de
  serviço), `urgente` e as relações `reservas`/`expedicoes`/`anexos`; `ReservaEstoque` e `Anexo`
  apontam para `ID_nota_saida`; `MovimentacaoEstoque` perdeu `ID_remessa`; `Expedicao` ganhou
  `ID_veiculo` e `ID_funcionario_condutor`; e `ExpedicaoRemessa` virou `ExpedicaoNota`
  (`expedicao_nota`, `ID_nota_saida`). A aba Saída (`/mov-estoque`) passou a ter um formulário
  único (destinatário, urgência, observação e itens) e a lista com ver/editar/cancelar; criar
  reserva o estoque na transação, editar corrige a reserva pelo delta e cancelar libera a
  reserva (idempotente), sempre com auditoria antes/depois. As cinco permissões `remessa.*`
  saíram do catálogo (foram para a limpeza de obsoletas) e `nota_saida` ficou com seis
  (`criar`, `alterar`, `consultar`, `cancelar`, `alterar_status`, `finalizar`), levando o seed de
  **80 para 77** permissões. A RN003 passou a apontar a própria nota em `BAIXA_PARCIAL` como
  pendência (sem *split*), e DER/`classes.puml` seguem com **49** entidades/classes.
  `ENTENDIMENTO.md` (§3.8, §3.10.2, §3.11, §3.15.1), `REGRAS_NEGOCIO.md`,
  `REQUISITOS_FUNCIONAIS.md`, `IMPLEMENTACAO.md` e `AGENTS.md` §8/§14 foram alinhados.
- **Conceito de organização das entregas renomeado para expedição `(KAN-140)`:** por decisão do
  usuário, o antigo nome do conceito deu lugar a **expedição** — inclusive no modelo físico. No
  schema, os modelos são agora `Expedicao` (`@@map("expedicao")`) e `ExpedicaoRemessa`
  (`@@map("expedicao_remessa")`), o enum é `StatusExpedicao`, as chaves são `id_expedicao*`
  (`ID_expedicao*`) e `Remessa.expedicoes` substitui a coleção antiga; os demais campos não
  mudaram e o DER/`classes.puml` seguem com **51** entidades/classes. As tabelas antigas
  estavam vazias (0/0) e nenhum perfil/permissão de usuário usava as cinco permissões antigas,
  então o rename não perdeu dados. As permissões do seed passaram a `expedicao.*` (catálogo
  segue com **80**) e as antigas foram removidas do banco. `src/types/index.ts` passou a
  exportar `STATUS_EXPEDICAO`/`StatusExpedicao`, e o status de veículo que indicava estar em
  deslocamento virou **`EM_EXPEDICAO`** (rótulo "Em expedição" na tela de veículos).
  `ENTENDIMENTO.md` (§3.10.2, §3.11.4, §3.15.1), `AGENTS.md` §14 e os diagramas foram
  alinhados.
- **Percurso é excluído fisicamente e a expedição não guarda o percurso `(KAN-140)`:** por
  decisão do usuário, `percurso` deixou de ter `ativo` e passou a ser **excluído
  fisicamente** (como `unidade_conversao`); `expedicao` perdeu `ID_percurso` — o percurso é
  apenas um atalho de ordenação no momento de montar a expedição. Antes do `db push` foi
  excluído o único percurso inativo existente (1 registro, 3 visitas) e confirmado que nenhuma
  expedição o referenciava. A permissão `percurso.desativar` virou `percurso.excluir` (catálogo segue com
  **80**) e a órfã `percurso.desativar` foi removida do banco. A tela perdeu a coluna
  Situação e a ação Desativar: excluir usa `ConfirmDialog`, exige `percurso.excluir` e avisa
  que a ação é permanente; a auditoria grava `Percurso`/`EXCLUIR` com o snapshot anterior. O
  nome passou a ser único entre todos os percursos. `AGENTS.md` §7/§13, `ENTENDIMENTO.md`
  §3.10.1/§3.10.2/§3.15.1, `IMPLEMENTACAO.md` e os diagramas foram alinhados.
- **Chave de acesso da NF-e vira coluna da nota de entrada `(KAN-140)`:** a tabela
  `nota_entrada_chave_acesso` deixou de existir; a chave passou a ser a coluna nullable e
  única `nota_entrada.chave_acesso VARCHAR(44)` — a nota tem no máximo uma chave, e o
  `@unique` preserva a unicidade que a tabela garantia. As chaves existentes foram
  transportadas antes da queda da tabela; o DAO não usa mais `createMany`, o serviço valida
  44 caracteres quando a chave é informada, o formulário tem um único campo opcional e a
  listagem mostra a chave ou "—". `ENTENDIMENTO.md` §3.12, `IMPLEMENTACAO.md` (RF017a) e
  `DER.puml` (agora **51** entidades) foram alinhados.
- **Reserva de estoque passa a pertencer à remessa `(KAN-140)`:** `reserva_estoque` trocou a
  FK `ID_nota_saida` por `ID_remessa` (`ReservaEstoque.id_remessa`); `Remessa` ganhou
  `reservas` e `NotaSaida` perdeu a relação. A nota de saída **deixa de reservar**: a reserva
  nasce quando a remessa planejada é criada com seus itens (`saldo_reservado += quantidade`),
  é liberada no cancelamento e baixada na finalização. Para `tipo = SAIDA` a nota não tem
  itens (os itens e o destinatário estão na remessa); `CONSUMO_INTERNO`, `AVARIA` e
  `DESMONTAGEM` continuam com itens em `item_nota_saida`, por serem baixas internas sem
  entrega. `AGENTS.md` §8.2–§8.4, `ENTENDIMENTO.md` (§3.7.1, §3.8.1, §3.8.2, §3.11.1,
  §3.11.2, §3.11.5) e `DER.puml` foram alinhados.
- **Documentação reorganizada por assunto:** `docs/` passou a ter três pastas — `dominio/`
  (ENTENDIMENTO, REGRAS_NEGOCIO, REQUISITOS_FUNCIONAIS, REQUISITOS_NAO_FUNCIONAIS e o novo
  IMPLEMENTACAO), `processo/` (VERSIONAMENTO, JIRA e WORKFLOW) e `diagramas/` (classes.puml,
  DER.puml, fluxo_atual.puml e os 6 sub-fluxos de `fluxosAtuais/`). Os **16** arquivos foram
  movidos com `git mv` (histórico preservado) e as antigas pastas `agents/` e `puml/` sob
  `docs/` deixaram de existir; as referências internas foram atualizadas e os caminhos antigos
  não aparecem mais em `grep`.
- **`docs/README.md` (novo)** — índice da documentação: o que é o projeto em uma linha, a
  tabela pasta → documento → para quê, e a indicação de que o modelo físico
  (`prisma/schema.prisma`) é a fonte de verdade.
- **`docs/dominio/IMPLEMENTACAO.md` (novo)** — mapa do que **já existe no código**: os 25
  requisitos funcionais (o `RF008` não existe e a lacuna é preservada) e os 9 requisitos não
  funcionais classificados em implementado/parcial/não implementado, cada linha com o arquivo
  que a sustenta, mais 4 pontos em aberto (autor das mensagens automáticas do mural, forma do
  registro de pendência da RN003, destino de `anexo.ID_documento_fiscal` e enforcement de
  `tipo_codigo`) — os **4 foram resolvidos pelo usuário em 2026-10-19** e a seção passou a
  registrar as decisões (ver a entrada "`docs/dominio/IMPLEMENTACAO.md` sem pontos em aberto",
  abaixo).
- **`ENTENDIMENTO.md` corrigido contra o schema (52 modelos):** removida a entidade
  inexistente `condutor` — o condutor é a flag `funcionario.condutor` e a FK
  `remessa.ID_funcionario_condutor`; `senha_hash` passou a nullable e `senha_alterada_em` foi
  incluído; `saldo_reservado` e `endereco.uf` acrescentados; `anexo.ID_documento_fiscal`
  então documentado como coluna sem tabela de destino (removida depois — ver `Removed`); a tabela de permissões passou a refletir as
  **68** permissões criadas por `prisma/seed.ts` (`listar`/`excluir` incluídos,
  `perfil.desativar` → `perfil.excluir`, sem `condutor.*`); a lista de valores de `acao` da
  auditoria passou a vir de `src/dao/_audit.ts`; a movimentação de estoque deixou de ser
  descrita com um "tipo" que a tabela não tem; a contagem de entidades foi corrigida para 52
  e a stack para Next.js 16 sem Chart.js; os fluxos AS-IS (`fluxo_atual.puml` e
  `fluxosAtuais/`) passaram a ser referenciados e separados do fluxo alvo.
- **Diagramas alinhados ao schema:** `classes.puml` ganhou as 5 classes que faltavam
  (MovimentacaoEstoque, ReservaEstoque, UsuarioPermissao, PerfilPermissao e
  RegistroAuditoria) e passou a ter as **52** classes dos 52 modelos; `DER.puml` passou de 54
  para **52** entidades (sem `condutor`/`condutor_codigo`), ganhou o relacionamento
  `nota_entrada ||--o{ chave_acesso` e os campos `uf` e `senha_alterada_em`; a multiplicidade
  invertida de `ConversaoUnidade` e os tipos `DECIMAL` (o schema usa `Float`) foram
  corrigidos nos dois diagramas.
- **`AGENTS.md`, `README.md` e os documentos de processo alinhados ao repositório real:** a
  fonte de verdade (§2) e as referências de §24 apontam para os caminhos novos; a stack virou
  "Next.js 16" e "MySQL/MariaDB (driver `@prisma/adapter-mariadb`)"; a árvore de §3 reflete o
  layout real (com `src/proxy.ts` e sem as pastas de API, autenticação e dashboard, nem
  diretório de migrations) e o uso de `prisma db push`; o `README.md` da raiz ficou enxuto (o que
  é o projeto, stack, como rodar, comandos essenciais — com `test` e `db:generate` — e um link
  para `docs/README.md`); no `JIRA.md`, o bullet que dizia que `#time` registra worklog foi
  corrigido, o repositório passou a ser citado como `enzoguinossi/projetofinalfaetec` e o
  exemplo de smart commit combinado ficou correto.
- **`REQUISITOS_FUNCIONAIS.md`:** o cabeçalho passou a registrar que **`RF008` não existe** e
  que a lacuna é preservada de propósito (sem renumerar e sem inventar requisito) — o total é
  25 RFs.
- **`mensagem_mural.ID_usuario` passou a ser opcional:** em `prisma/schema.prisma` a coluna
  deixou de ser `NOT NULL` (`id_usuario Int?`) e a relação com `usuario` virou opcional, para
  permitir as mensagens automáticas do sistema (RN002/RF014) sem autor humano — `NULL` passa a
  significar "sem autor" e a coluna `automatica` marca o caso. O `count` de
  `src/dao/usuario.ts` (`verificarRelacionamentos`) continua correto: mensagens com `NULL` não
  são atribuídas a nenhum usuário. (Decisão do usuário, 2026-10-19 — sem chave de issue.)
- **RN003 realizada como a remessa `PENDENTE` (sem tabela nova):** o "registro automático de
  pendência vinculado ao destinatário" da RN003 é a remessa com status `PENDENTE` criada no
  *split* de uma entrega parcial, já vinculada por `remessa.ID_destinatario`; o que falta
  entregar continua derivado de `item_nota_saida.qtd_esperada − qtd_entregue`. O texto da regra
  em `docs/dominio/REGRAS_NEGOCIO.md` **não mudou de sentido** — ganhou uma linha de "Realização
  no modelo", e `docs/dominio/ENTENDIMENTO.md` §3.11.2 passou a ligar o split à RN003. (Decisão
  do usuário, 2026-10-19 — sem chave de issue.)
- **`tipo_codigo` sem permissões é intencional (dado de referência):** não há CRUD, tela nem
  Server Action de gestão — `src/dao/tipo-codigo.ts` só lê (`list`, `listParaEntidade`,
  `getByNomes`) e os formulários apenas escolhem entre os tipos permitidos; por isso não existe
  permissão `tipo_codigo.*` no seed. Registrada também a invariante de que o catálogo existe em
  `TIPOS_CODIGO`/`TIPOS_POR_ENTIDADE` (`src/lib/codigo.ts`) e nas **6** linhas de `tipo_codigo`
  criadas por `prisma/seed.ts`, e que **quem manda é o TypeScript** — `tiposPermitidosPara()` e
  `tipoPermitido()` recusam tipo ausente da constante mesmo que exista no banco.
  (`docs/dominio/ENTENDIMENTO.md` §3.15.6.) (Decisão do usuário, 2026-10-19 — sem chave de
  issue.)
- **`docs/dominio/IMPLEMENTACAO.md` sem pontos em aberto:** a seção foi substituída pelo
  registro das **4** decisões de 2026-10-19 (autor das mensagens automáticas do mural, forma do
  registro de pendência da RN003, destino de `anexo.ID_documento_fiscal` e enforcement de
  `tipo_codigo`) — nenhuma delas permanece pendente.
- **A nota de saída deixou de ter destinatário:** a coluna `nota_saida.ID_destinatario` saiu do
  modelo em 2026-10-19 — a nota é o documento que **agrega remessas**, e são as remessas/coletas
  que carregam o destinatário da entrega (`remessa.ID_destinatario`, `coleta.ID_destinatario`).
  O vínculo do destinatário nas guardas de exclusão (`src/dao/destinatario.ts`) passou a ser
  contado por **remessa e coleta** (além de pedido e percurso) — a guarda continua bloqueando a
  remoção de um destinatário com entregas. `docs/dominio/ENTENDIMENTO.md` §3.11.1 e
  `docs/diagramas/DER.puml` alinhados. (Decisão do usuário, 2026-10-19 — sem chave de issue.)
- **A nota de saída passa a consolidar pedidos (FK invertida):** o vínculo migrou de
  `nota_saida.ID_pedido_escola` (única, no máximo uma nota por pedido) para
  `pedido_escola.ID_nota_saida` — uma nota agrega **N** pedidos e cada pedido pertence a **no
  máximo uma** nota. Os vínculos existentes foram transportados para o lado novo **antes** da
  queda da coluna antiga: **0** linhas transportadas (nenhuma das 4 notas tinha
  `ID_pedido_escola` não nulo e a tabela `pedido_escola` estava vazia). `ENTENDIMENTO.md`
  §3.11.0/§3.11.1 e `DER.puml` (52 entidades) alinhados; `IMPLEMENTACAO.md` ganhou o **ponto em
  aberto** *como* o pedido entra numa nota (nota nova a cada confirmação ou juntar-se a uma nota
  aberta) — a regra não foi inventada. (Decisão do usuário, 2026-10-19 — sem chave de issue.)
- **Prioridades dos requisitos alinhadas à realidade operacional:** cinco requisitos passaram a
  **Essencial** — `RF009` (era Desejável: é o único canal de notificação da RN002 e do `RF014`,
  ambos Essenciais), `RF013` (era Importante: pré-requisito do `RF017a` — sem a conversão
  caixa→unidade a entrada não registra a quantidade real), `RF016` (era Importante: é a única
  forma de registrar saída que não é entrega — consumo interno e avaria), `RF024` (era
  Importante: é a mesma capacidade do `RNF008`, que já é Essencial) e `RNF002` (era Importante:
  incide sobre a busca por código de barras do `RF011`, Essencial, usada no balcão). O `RF022`
  permanece **Importante** — o usuário decidiu **não** dividir expedição/percurso. Só a coluna de
  prioridade mudou; o texto e o escopo dos requisitos não foram alterados. (Decisão do usuário,
  2026-10-19 — sem chave de issue.)
- **`docs/dominio/ESCOPO_FORA.md` (novo) — os requisitos que não serão implementados:** reúne
  `RF025` (importação de NF-e por XML) e `RNF009` (interoperabilidade, XML NF-e), ambos
  mantidos como Desejáveis e remarcados "fora do escopo", com o critério de exclusão (nenhuma
  regra de negócio nem requisito Essencial depende dele; a necessidade é atendida por outro
  caminho já previsto na especificação; o custo é desproporcional ao ganho) e a observação de
  que os dois descrevem **a mesma capacidade** e devem ser tratados como um item se voltarem
  ao escopo. A necessidade de entrada de nota fica coberta pelo `RF017a`, que prevê a entrada
  **com ou sem** chave de acesso NF-e. Ponteiros no cabeçalho de
  `docs/dominio/REQUISITOS_FUNCIONAIS.md` e de `docs/dominio/REQUISITOS_NAO_FUNCIONAIS.md` e
  linha nova no índice `docs/README.md`. (Decisão do usuário, 2026-10-19 — sem chave de issue.)
- **`RF018` (Quadro Kanban de Remessas) passou a fora do escopo:** o acompanhamento visual já
  é feito no **Trello**, atualizado na rua, durante as entregas, por quem executa o serviço; o
  projeto **não tem infraestrutura para hospedar o sistema online** e permitir acesso de
  qualquer lugar, e um Kanban servido pelo Nexus exigiria uma **interface mobile dedicada** —
  esforço muito acima do ganho. O status de cada remessa continua registrado no modelo, para
  consultas e relatórios. `docs/dominio/ESCOPO_FORA.md` foi reescrito para justificar cada
  exclusão em seção própria (critério, resumo e o que atende à necessidade). Em consequência,
  o `RNF002` deixou de citar o Kanban: o requisito de desempenho trata agora só da busca por
  código de barras. (Decisão do usuário, 2026-10-19 — sem chave de issue.)

### Removed

- **`anexo.ID_documento_fiscal` removida do modelo:** a coluna era órfã — não existe modelo
  `documento_fiscal`, não há FK e nenhum código em `src/**` a lê ou escreve. A remoção foi
  precedida da conferência no banco, que deu **0** linhas com valor não nulo
  (`SELECT COUNT(*) FROM anexo WHERE ID_documento_fiscal IS NOT NULL`). (Decisão do usuário,
  2026-10-19 — sem chave de issue.)
- **`nota_saida.ID_destinatario` removida do modelo:** a nota deixou de ter destinatário (ver a
  entrada correspondente em *Changed*) e a coluna saiu de `prisma/schema.prisma`. A remoção foi
  precedida da conferência no banco, que deu **1** linha com valor não nulo
  (`SELECT COUNT(*) FROM nota_saida WHERE ID_destinatario IS NOT NULL`, sobre 4 notas). (Decisão
  do usuário, 2026-10-19 — sem chave de issue.) **Reavaliado em 2026-10-23:** com a fusão de nota
  e remessa, `ID_destinatario` voltou à nota de saída como FK opcional (obrigatória para
  `SAIDA`), já que a nota passou a ser a entrega.

## [1.17.10.2026] - 2026-10-17

Primeira versão do Nexus. Como não existe versão anterior, esta seção descreve **o que o
sistema entrega hoje**: os módulos de cadastro e de acesso, a autenticação, a trilha de
auditoria, a infraestrutura de orquestração multiagente e a ferramenta de exportação para o
Figma. `Changed` e `Fixed` registram as mudanças e as correções feitas até esta primeira
publicação.

O escopo desta versão é o **acesso e os cadastros**. A operação de estoque (notas de entrada e
de saída, movimentações e reservas), as remessas e rotas, o inventário, o mural e os relatórios
**ainda não têm telas** e não fazem parte desta publicação — embora o modelo físico deles já
esteja no banco.

### Added

- **Autenticação e sessão:** login com senha (BCrypt) e token JWT HS256 (`jose`) em cookie
  `nexus_token`; rotas privadas protegidas por `src/proxy.ts`; a sessão é revalidada no banco a
  cada requisição e cai quando o usuário é desativado ou a senha muda; primeiro acesso,
  definição de senha e logout. (KAN-136, KAN-137)
- **Usuários, perfis e permissões:** CRUD de usuários, página de perfis-template e painel de
  permissões reutilizável; aplicar um perfil **substitui** as permissões do usuário e não cria
  vínculo; verificação `entidade.acao` no servidor e gating na interface; Super Admin
  (`super_admin`) imutável, com todas as permissões e fora da lista de permissões da interface.
  (KAN-137, KAN-164)
- **Trilha de auditoria:** `registro_auditoria` gravado na mesma transação da operação, com
  usuário, data/hora, entidade, ID do registro afetado e snapshots JSON de antes/depois, em
  criação, alteração, desativação e exclusão — e também em login, falha de login, logout e
  definição de senha (`src/dao/_audit.ts`). (KAN-164)
- **Cadastros base:** Funcionários (pessoa física, flag de condutor), Destinatários (escola ou
  creche, com endereço obrigatório), Fornecedores e Veículos (placa, modelo e status), cada um
  com criar/editar/visualizar em modal, busca, paginação e exclusão recusada quando existem
  vínculos. (KAN-138, KAN-153, KAN-154, KAN-155)
- **Códigos personalizados por entidade:** seção reutilizável no formulário, com o tipo validado
  por cadastro e o formato conferido — EAN12/EAN13 (produto), `COD_ESCOLA`, `MATRICULA`,
  `COD_FORNECEDOR` e `DIGITACAO` (`src/lib/codigo.ts`, `CodigosSection`). (KAN-138, KAN-139,
  KAN-153, KAN-154, KAN-155)
- **Contatos e endereço:** telefones (com tipo e DDD) e e-mails por entidade, com validação e
  formatação; endereço com busca por CEP que preenche logradouro, bairro, cidade e UF
  (`src/services/contato.ts`, `src/services/cep.ts`). (KAN-137, KAN-138, KAN-153, KAN-154)
- **Produtos:** catálogo com descrição, foto, flags **Perecível** e **Composto**, data de
  validade e conversão de unidade padrão; a foto entra por upload ou URL e é validada,
  redimensionada (máx. 1024px) e convertida para WEBP; composição com insumos; a listagem mostra
  a quantidade e a **quantidade livre** (`quantidade_atual − saldo_reservado`) somando os
  estoques do produto. (KAN-139, KAN-164)
- **Unidades de conversão:** cadastro standalone de nome e fator, gerenciado em modal a partir do
  cadastro de produto. (KAN-139)
- **Listagens e formulários padronizados:** paginação feita no servidor, busca com priorização
  (código antes da descrição), tabela e barra de paginação compartilhadas e o mesmo fluxo de
  criar/editar/visualizar/excluir em todas as telas de cadastro. (KAN-139, KAN-164)
- **Interface:** Tailwind v4 com os tokens de design em `@theme` no `src/app/globals.css` e
  biblioteca de componentes compartilhados (Button, Modal, ConfirmDialog, Aviso, DataTable,
  Sidebar…). (KAN-137, KAN-164)
- **Base de dados:** `prisma/schema.prisma` descreve o modelo físico do domínio — cadastros,
  estoque e reservas, movimentações, notas de entrada e de saída, remessas, rotas e percursos,
  inventário, permissões, auditoria e mural — com o cliente Prisma 7 sobre MySQL; o seed
  (`npm run db:setup`) popula apenas dados de referência (tipos de código, permissões,
  perfis-template e unidades de conversão) e o Super Admin nasce no fluxo de primeiro acesso.
  (KAN-164)
- **Testes:** 18 arquivos e 165 testes cobrindo DAOs, serviços e bibliotecas (`npm test`,
  Vitest), executados no CI em `.github/workflows/tests.yml`. (KAN-146)
- **Ferramenta de exportação para o Figma (`tools/figma-export`):** plugin local +
  servidor local (sem o MCP oficial), colheita de 47 telas com Playwright e reconstrução
  das telas como componentes reutilizáveis com propriedades, com captura 1:1 de referência.
  (KAN-166)
- **Ferramenta de exportação para o Figma · volta (Figma → app):** aba *Ler do Figma* no
  plugin, leitura de página para
  `out/figma-export/figma/<página>.json` e `figma:diff` (tokens × `globals.css`,
  componentes casados por nome + âncora de código e telas).
- **Ferramenta de exportação para o Figma · scripts:** `figma:harvest`, `figma:serve`,
  `figma:check`, `figma:compare`, `figma:diff`, `figma:fixtures` e a skill
  `.opencode/skills/figma-export`.
- **Ferramenta de exportação para o Figma · verificação sem abrir o Figma:** `figma:check`,
  com 18 invariantes — incluindo a **guarda de reuso** que falha se um componente promovido
  perder a marca `data-figma` no código e a que prova que as **variáveis do Figma convergem
  para os tokens do `globals.css`**.
- **Infraestrutura de orquestração multiagente:** agentes versionados em `.opencode/agents/`
  (orchestrator, developer, reviewer, qa, docs-keeper, release-manager). (KAN-165)
- **Infraestrutura de orquestração multiagente · skills:**
  `.opencode/skills/{orchestration,jira-smart-commits,release}/SKILL.md`.
- **Infraestrutura de orquestração multiagente · estado persistente:** `.ai-workflow/`
  (`PROJECT_STATE.md`, `contracts/`, `runs/`, `decisions/`) e ADR 0001.
- **Versionamento:** convenção DateVer `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`) e este changelog.
- **Documentação:** `docs/VERSIONAMENTO.md`, fonte detalhada da convenção de versionamento e
  changelog (DateVer + Keep a Changelog 1.1.0 pt-BR), com exemplos de releases no mesmo dia,
  escrita de entradas, rastreabilidade versão ↔ issues ↔ commit e o que nunca fazer.
  Referenciado no cabeçalho do `CHANGELOG.md`, no `README.md` e no `AGENTS.md`. (KAN-166)

### Changed

- Componentes compartilhados (`src/components/*`) receberam marcas `data-figma*`
  (atributos aditivos: não alteram comportamento nem visual) que ligam a UI aos
  componentes do design. Na mesma entrega houve uma **mudança visual pretendida**: a
  fonte **Inter** passou a ser carregada com `next/font/google` e `--font-sans`,
  `--font-display` e a sidebar passaram a apontar para ela — antes não havia fonte
  carregada, o navegador pintava Arial/Segoe UI e o `figma:compare` divergia em todas
  as telas.
- Tokens de design passaram a ter **fonte única** no `src/app/globals.css`: a colheita os
  lê (`tools/figma-export/tokens.ts`) e os leva no manifesto, e o plugin **atualiza as
  variáveis existentes e cria as novas** nas coleções `Nexus / Cor` e `Nexus / Métrica`
  (upsert; nada é removido). A cópia à mão que existia em `plugin/code.js`
  (`TOKENS_COR`/`TOKENS_METRICA`) foi removida — era ela que ficava desatualizada quando
  o `globals.css` mudava. Foram acrescentados ao `@theme` apenas os tokens que só
  existiam nessa cópia (`--color-branco`, `--raio-lg`, `--raio-xl`, `--raio-pill`);
  **nenhum valor de token existente mudou**.

### Fixed

- Exportação para o Figma — quatro defeitos de **reconstrução** encontrados na revisão das
  telas contra a captura de referência (a cena estava correta; a montagem no Figma não):
  - **Lupa do CEP coberta:** `flex-grow` virava "Fill" nos dois filhos da linha CEP+UF e o
    auto-layout do Figma, que **não tem peso**, dividiu a linha em duas colunas iguais
    (210px): a coluna do CEP encolheu com o conteúdo transbordando e o select da UF passou
    a cobrir o botão da lupa. `grow` agora só é emitido quando há **um** filho que cresce e
    **sobra** para distribuir (o tamanho medido manda).
  - **Paginação em duas linhas** ("Página 1 de" / "0"): `{a} de {b}` no JSX são três nós de
    texto e as três caixas de `Range.getClientRects` eram contadas como três **linhas** — o
    texto saía como quebra automática (`HEIGHT`) e o Figma o re-quebrava. Agora são
    contadas **linhas visuais** e `white-space: nowrap` (herdado) proíbe a quebra.
  - **Vão no `ConfirmDialog`** (excluir de funcionários/destinatários): o mestre vem da
    ocorrência mais completa (mensagem de 3 linhas) e a instância herdava a altura do
    parágrafo, empurrando a barra de botões 23px para baixo. A instância agora adota o
    tamanho da **sua** ocorrência.
  - **Deriva vertical no modal de destinatário:** o campo `flex-1` de uma coluna esticada
    pela grade ficava com `grow` mesmo sem o navegador tê-lo crescido; no Figma o "Fill"
    absorvia os 233px de sobra e os campos seguintes saíam do recorte do modal.
- `figma:check`: quatro invariantes novas de **fidelidade da montagem** (15–18), uma por
  defeito, cada uma provada com o defeito reintroduzido. Os quatro eram erros de
  **reconstrução**: nenhum arquivo de `src/**` mudou por causa deles (a mudança visual do
  `src/**` nesta entrega é a fonte Inter, em *Changed*).
- Exportação para o Figma — **endurecimento pós-revisão** (KAN-166): o plugin não derruba
  mais a importação num `catch` sem binding (uma cena que não carrega ou uma conferência 1:1
  que não envia passam a ser **registradas com a mensagem real** e a importação continua); o
  manifesto lista **só as cenas capturadas** e o `figma:check` falha com mensagem clara
  ("rode `npm run figma:harvest`") em vez de `ENOENT`; o servidor local escuta em
  **`127.0.0.1`**; os fixtures **recusam** rodar contra o banco da aplicação; e as
  invariantes 15/16 passam a valer também sobre a **árvore** montada (não só a cena), com um
  alvo de pareamento ausente virando falha em vez de ser pulado.

<!--
Categorias: Added, Changed, Deprecated, Removed, Fixed, Security.
Não crie uma versão nova sem cumprir o checklist de release.
Próximo release: sem data marcada — depende de o sistema ganhar telas para os módulos que
ficaram fora de 1.17.10.2026 (estoque, notas, remessas e rotas, inventário, mural e relatórios).
-->
