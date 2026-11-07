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
- **Bandeja .NET 10 (KAN-170):** `NexusTray` em `net10.0-windows`, self-contained/single-file,
  com status de `NexusMySQL84`/`NexusApp`/`NexusCaddy`, `Iniciar Nexus`, `Fechar bandeja`
  (confirmação e encerramento Caddy→App→MySQL), ícone cinza quando parado intencionalmente e
  fallback de ícone para falhas de GDI+ (`ExternalException`).
- **Liga/desliga pela bandeja (KAN-170):** `iniciar-nexus.ps1`, `encerrar-nexus.ps1`,
  `abrir-bandeja.vbs` e `nexus-state.json`; atalho **Bandeja do Nexus** na Área de Trabalho
  (tarefa `NexusTray`, sem UAC) ao lado do atalho **Nexus** do site. Sem watchdog.

### Changed
- **Backup com o Nexus parado (KAN-170):** `backup.ps1` registra “MySQL parado; backup
  ignorado” e sai 0, sem falhar a tarefa diária.
- **ACL do usuário da instalação (KAN-170):** o SID do usuário que executou o setup recebe
  `Modify` em `C:\ProgramData\Nexus` e subpastas (`config`, `mysql`, `caddy`, `backups`,
  `logs`, `uploads`) e nos arquivos `backup.cnf`, `Caddyfile` e `my.ini`. Administrators e
  SYSTEM continuam com FullControl e os serviços mantêm o acesso; `C:\Program Files\Nexus`
  e `app\.env` não mudam. `Protect-File` ganhou `-ModifyIdentities`.
- **Instalador sem console (KAN-170):** o Inno Setup passa a chamar o `bootstrap.ps1`
  diretamente. O wizard ganha a página de credenciais do MySQL (root e `nexus_app`, com
  confirmação) e uma janela modal de progresso com barra e fase atual. As senhas são
  entregues por um arquivo temporário UTF-8 sem BOM com ACL restrita
  (Administrators/SYSTEM), apagado ao final; no upgrade, os quatro campos vazios reutilizam
  as credenciais do `backup.cnf`. O `bootstrap.ps1` ganhou `-CredentialsFile`,
  `-ProgressFile` e `-NoPrompt`; a instalação manual continua pedindo as senhas no console.

### Fixed
- **Upgrade com NSSM/Caddy em uso (KAN-170):** o bootstrap compara o hash do `nssm.exe` e a
  versão do `caddy.exe` com o payload; se já estão corretos, não toca nos binários (evita o
  erro “arquivo em uso” dos serviços). Se divergirem, para `NexusCaddy`/`NexusApp`, copia e
  reinicia.

### Removed
- **Item “Sair” da bandeja (KAN-170):** substituído por **Fechar bandeja**, que confirma e
  encerra o Nexus (Caddy→App→MySQL) quando há serviço rodando.
- **`instalar-gui.ps1` (KAN-170):** removido do repositório e do `[Files]`. O instalador não
  abre mais janela de console nem grava `instalador-*.log`; o log do Inno fica em
  `%TEMP%\Setup Log*.txt`.

### Fixed
- **sharp/libvips e NexusApp travada (KAN-170):** o pacote standalone passa a incluir
  `sharp`/`@img` completos (DLLs do libvips), corrigindo o `ERR_DLOPEN_FAILED`; o serviço é
  reiniciado sem deixar node órfão na porta 3000, evitando `NexusApp: Paused`.
- **Fase 0 e código de saída do setup (KAN-170):** a fase 0 do bootstrap encerra o node órfão
  do Nexus na porta 3000 antes de falhar (nunca processo de terceiros) e o setup retorna
  código 1 quando o bootstrap não conclui.

## [1.07.11.2026] - 2026-11-07

Esta seção consolida o instalador autocontido: Node portátil, MySQL 8.4, Caddy, VC++, NSSM e
app Next standalone embutidos; seed SQL sem Prisma; conversões `PCT10`/`CX50`.

### Added
- **Next standalone (KAN-170):** `output: "standalone"`; `scripts/empacotar-standalone.mjs`
  gera `app.zip` com `server.js`, `.next/static`, `public` e client Prisma, sem `.env`/uploads.
- **Node portátil (KAN-170):** Node 24.19.0 em `C:\Program Files\Nexus\node`, fora do PATH;
  `NexusApp` roda `node.exe server.js`.
- **Payload autocontido (KAN-170):** `scripts/preparar-payload.ps1` monta Node, MySQL 8.4.13,
  Caddy, VC++, NSSM, app e SQL em `deploy/windows/payload`; o Inno Setup embute tudo.
- **Seed SQL (KAN-170):** `deploy/sql/schema.sql` + `seed.sql` (tipos, 81 permissões,
  2 perfis, vínculos e 3 conversões) e migração de unidades; o instalador aplica com
  `mysql.exe`, sem Prisma.
- **MySQL isolado (KAN-170):** dados/my.ini em `C:\ProgramData\Nexus\mysql`; serviço
  `NexusMySQL84` na 3214; migração do caminho legado.

### Changed
- **Conversões:** `PACOTE`→`PCT10` e `CAIXA`→`CX50`; `UNIDADE` permanece padrão/fator 1.
- **Atualização:** `atualizar.ps1` passa a trocar pacote standalone + SQL, sem Git/npm/build.
- **Desinstalação:** remove Node/MySQL/Caddy/NSSM/app, preservando `C:\ProgramData\Nexus`.

## [11.02.11.2026] - 2026-11-02

Esta seção elimina a dependência de `nssm.cc` durante a instalação.

### Changed
- **NSSM embutido e fallback (KAN-170):** o `nssm.exe` 2.24 (win64) passa a ir no payload do
  Inno Setup (`tools\nssm\nssm.exe`); o bootstrap usa o arquivo embutido, valida o SHA-256 e
  só baixa da URL oficial ou dos mirrors (`manifesto.nssm.mirrors`) se ele faltar. O mirror
  aponta para a cópia versionada no repositório/tag.

## [10.02.11.2026] - 2026-11-02

Esta seção corrige a reinstalação da bandeja com o processo em execução.

### Fixed
- **Reinstalação da bandeja (KAN-170):** o bootstrap para a tarefa `NexusTray` antes de
  encerrar o processo e copiar o novo executável, evitando a violação de compartilhamento
  e garantindo que o novo processo inicie.

## [9.02.11.2026] - 2026-11-02

Esta seção permite atualizar a bandeja com o processo em execução.

### Fixed
- **Atualização da bandeja (KAN-170):** o bootstrap para o `NexusTray` em execução antes de
  copiar o novo `NexusTray.exe` (com retry) e registra/inicia a tarefa em seguida.

## [8.02.11.2026] - 2026-11-02

Esta seção corrige a atualização da aplicação em uma instalação existente.

### Fixed
- **Atualização da aplicação (KAN-170):** o bootstrap agora para `NexusApp`/`NexusCaddy`
  antes de `npm ci`/`npm run build`, evitando o bloqueio de arquivos em `node_modules`/
  `.next`; a fase 5 religa os serviços.

## [7.02.11.2026] - 2026-11-02

Esta seção inicia a bandeja imediatamente após a instalação.

### Fixed
- **Bandeja NexusTray (KAN-170):** a tarefa `NexusTray` continua registrada no logon do
  usuário que instalou, mas o bootstrap agora a inicia ao final da fase 6 e confirma o
  processo; se não iniciar, avisa e mantém o gatilho para o próximo logon.

## [6.02.11.2026] - 2026-11-02

Esta seção consolida as correções do serviço MySQL 8.4 e do bootstrap no Windows.

### Fixed
- **Serviço MySQL 8.4 e bootstrap (KAN-170):** o serviço `NexusMySQL84` é criado com o
  nome do serviço no `binPath` (modo de serviço do `mysqld`), o `pos-instalacao-mysql.ps1`
  reescreve o `my.ini` (sem depender de lista vazia no PowerShell 5.1), as chamadas ao NSSM
  não tratam o banner em `stderr` como erro fatal, a colisão entre `$appPassword` e
  `$AppPassword` foi removida, e o hostname é adicionado ao `hosts` local quando não há DNS
  para o smoke HTTPS. O `Fail` e exceções agora gravam em `nexus-fail.log`.

## [5.02.11.2026] - 2026-11-02

Esta seção corrige a criação do serviço do MySQL 8.4 no Windows.

### Fixed
- **Serviço do MySQL 8.4 (KAN-170):** o MySQL 8.4 removeu `mysqld --install`; o instalador
  agora cria o `NexusMySQL84` pelo SCM (`New-Service` + `sc.exe config`), mantendo o
  `--initialize-insecure`. O bootstrap também adiciona o hostname ao `hosts` local
  (`127.0.0.1`) quando não há DNS, para o smoke HTTPS; as senhas podem ser passadas por
  parâmetro para execução não interativa.

## [4.02.11.2026] - 2026-11-02

Esta seção consolida a senha do MySQL sem mínimo, com repetição do prompt.

### Fixed
- **Senha do MySQL sem mínimo e com repetição (KAN-170):** a senha de `nexus_app` passou
  a aceitar qualquer tamanho (até 256 caracteres) e composição; apenas `@`, `/`, `?`, `#`,
  `"`, `\`, `;`, espaço, tab e caracteres de controle continuam bloqueados. O prompt agora
  avisa e repete a leitura em vez de encerrar, inclusive quando uma senha inválida é
  recebida por parâmetro; o root continua exigindo apenas senha não vazia e sem quebra de
  linha.

## [3.02.11.2026] - 2026-11-02

Esta seção consolida o MySQL 8.4 dedicado do Nexus na porta 3214 e as regras de firewall.

### Changed
- **MySQL dedicado na 3214 e firewall (KAN-170):** a instalação Windows passou a usar uma
  instância MySQL **8.4.13 LTS** própria — serviço `NexusMySQL84`, `127.0.0.1:3214`,
  binários em `C:\Program Files\Nexus\mysql` e dados/configuração em
  `C:\ProgramData\MySQL\MySQL Server 8.4` — instalada automaticamente pelo
  `instalar-mysql.ps1` no bootstrap, **sem pausa** e sem tocar no MySQL existente na 3306.
  `DATABASE_URL`, `backup.cnf`, `mysqldump` e a restauração usam a 3214, e o `NexusApp`
  depende do `NexusMySQL84`. O bootstrap cria as regras `Nexus HTTP`/`Nexus HTTPS` (Allow) e
  `Nexus MySQL (LAN)`/`Nexus Next (LAN)` (Block) para `LocalSubnet`; o `smoke.ps1` valida as
  quatro. A desinstalação remove serviço, binários e regras, preservando os dados de
  `C:\ProgramData\MySQL\MySQL Server 8.4` e de `C:\ProgramData\Nexus` (exceto `caddy`); o
  runbook foi atualizado.

## [2.02.11.2026] - 2026-11-02

Esta seção consolida a instalação e a operação em produção no Windows (KAN-170): health
check, uploads configuráveis, automação NSSM/Caddy, bandeja e instalador Inno Setup.

### Added
- **Produção Windows (KAN-170):** entrega da instalação e operação em servidor Windows —
  `GET /api/health` público (200 com `db=true`; 503 quando o banco não responde) e raiz de
  uploads configurável por `UPLOADS_DIR`, fora da pasta da aplicação para sobreviver à
  atualização; `bootstrap.ps1` em 8 fases idempotentes/retomáveis, com NSSM (serviços
  `NexusApp` e `NexusCaddy`), Caddy com CA interna via `certutil` e `admin off`, ACLs
  restritas (backups/config/CA fora do alcance do serviço), MySQL 8.4 LTS com
  `nexus_prod`/`nexus_app` e tarefa `NexusBackup` (diária, 02:00); bandeja `NexusTray`
  (.NET 8) no logon, com reinício via `restart.ps1`; instalador Inno Setup
  `NexusSetup-<versão>.exe`, `atualizar.ps1` com backup/rollback e `desinstalar.ps1` que
  preserva `C:\ProgramData\Nexus`; runbook em
  [`docs/processo/PRODUCAO.md`](docs/processo/PRODUCAO.md).

## [1.02.11.2026] - 2026-11-02

Esta seção consolida os relatórios padronizados (ficha, faixas e cartões), o Extrato de
Produto em rota própria, a auditoria legível e o seed de movimentações, sobre a base dos
cadastros repaginados.

### Added
- **Relatórios padronizados em ficha, faixas e cartões (KAN-157):** os relatórios de
  cadastro (produtos, funcionários, destinatários e fornecedores) passaram ao layout
  **ficha** — banda de identidade com código, descrição e situação, foto quando houver,
  seções e grade de 4 colunas com todos os códigos personalizados — e os demais ganharam
  componentes compartilhados (`FichaRelatorio`, `RelatorioCadastro`, `BadgeStatus` e
  `CartaoRegistro`). **Vencimento** agrupa por urgência (vencidos, hoje, 1–30, 31–60,
  61–90 e mais de 90 dias) com badge de dias restantes; **Pedidos por Escola** mostra faixa
  por escola, sub-faixa por pedido com status em badge e itens em linhas; **Expedições por
  Período** usa faixa por dia e cartão por expedição; **Entregas por Instituição** usa faixa
  por instituição e cartão por nota, com justificativa e fotos. Todos em A4 retrato, com
  impressão/PDF e CSV próprios; `id_destinatario` entrou nas linhas de pedidos e entregas
  para o agrupamento.
- **Extrato de Produto em rota própria (KAN-157):** `/relatorios/extrato` lista as
  movimentações por produto (com ou sem produto selecionado — sem filtro, todos os que têm
  movimento) com saldo anterior/posterior e totais; a Movimentação
  (`/relatorios/movimentacao`) continua por documento. Cada tela tem a sua exportação CSV.
- **Auditoria legível (KAN-157):** `/relatorios/auditoria` passou a mostrar o diff
  estruturado em vez de JSON — campos simples em `antes → depois`, coleções como blocos por
  item (código + descrição) com **uma linha por atributo alterado**, descrições de
  entidades e referências resolvidas em lote, `[oculto]` para campos sensíveis e sem diff
  em `LOGIN`/`LOGOUT`/`LOGIN_FALHA`.
- **Seed de movimentações dev-only (KAN-157):** `prisma/seed-movimentacoes.ts` +
  `npm run db:seed:mov` geram entradas, saídas, pedidos, remessas e expedições no banco
  `nexus` para exercitar os relatórios; aditivo/idempotente e recusado em produção.
- **Tipos de destinatário CMEI e CMEIA (RUN-20261101-98):** `TipoDestinatario` passou a
  `ESCOLA`, `CRECHE`, `CMEI` e `CMEIA` (rótulos exatos) no schema, tipos, ficha, listagem,
  filtros/relatórios, percursos e seletores de saída. O seed de demonstração ficou com
  3 escolas, 3 creches, 2 CMEI e 2 CMEIA.
- **Repaginação dos cadastros (ficha) e remoção de latitude/longitude:** produto, funcionário,
  destinatário e fornecedor passaram a usar a ficha com banda de identidade, seções, listas
  compactas de contatos/códigos e rodapé fixo. Produto e funcionário têm foto na banda;
  destinatário/fornecedor usam iniciais e preservam **CNPJ (Consultar)** e **CEP (Buscar)**,
  que preenchem os dados sem sobrescrever número/complemento. `endereco.latitude` e
  `endereco.longitude` foram removidas do schema, DTOs, DAOs, formulário e testes.
- **Seed de demonstração dev-only:** `prisma/seed-demo.ts` + `npm run db:seed:demo`,
  separado do seed de referência, com 10 funcionários, 10 destinatários, 10 fornecedores,
  10 veículos e 10 produtos (dados do 4devs/Bluesoft). Aditivo/idempotente e recusado em
  produção.
- **Fotos em `anexo` e tentativa de entrega (RUN-20261031-89/90, RF020/RF021):** `anexo`
  virou tabela de **dono polimórfico** — exatamente um entre `ID_produto`, `ID_funcionario` e
  `ID_expedicao_nota` (cascade), mais `ID_usuario`; `anexo.ID_nota_saida` e
  `produto.foto_url` foram removidos. **Produto e funcionário têm 1 foto ativa** (troca
  desativa a anterior e o arquivo antigo é apagado só depois do commit; falha de transação
  remove o arquivo novo), com os componentes reutilizáveis `FotosField`/`FotosGaleria`.
  **Funcionário ganhou foto** no cadastro e na visualização. A **tentativa de entrega**
  (`expedicao_nota`) passou a guardar `justificativa` (obrigatória no "não entregue",
  1..1000), `data_tentativa`, `ID_usuario_tentativa` e **0..5 fotos**, imutáveis depois de
  registrada; a nota de saída exibe o histórico de tentativas somente leitura. **Entrega
  parcial:** o formulário lista só itens com pendência (completos em bloco somente leitura) e
  usa **"entregar agora"** com o delta (default = pendência); o servidor recusa item sem
  pendência, redução do já entregue, item de outra nota e zero sem corte/justificativa.
  **Relatórios:** checkbox opcional **"Listar fotos"** em Produtos, Funcionários, Entregas e
  Expedições (miniaturas, justificativa em Entregas e URL no CSV), em A4 retrato. Uploads de
  5 fotos exigem `serverActions.bodySizeLimit =
  "12mb"` (`next.config.ts`). Cobertura: `tests/services/anexo.test.ts`,
  `tests/app/fotos-cadastro.test.ts` e `tests/services/expedicao.test.ts` (parcial,
  justificativa e duas tentativas).
  **Pendência de release:** os `scripts` de migração do `anexo` em produção ainda não existem
  (o `db push` com `id_nota_saida → id_expedicao_nota`/`foto_url → anexo` é destrutivo).
- **Gestão de Pedidos (RUN-20261028-87/88, RF025):** módulo `/pedidos` em que o pedido é
  **somente a solicitação** — sem reserva de estoque, sem número e **sem `ativo`** (não há
  desativar/excluir; o histórico é o status `PENDENTE`/`CONFIRMADO`/`RECUSADO`, com
  `data_criacao` automática). Só `PENDENTE` é editável; editar/aprovar/recusar usam transição
  condicional (`WHERE status = PENDENTE`) e geram auditoria. Itens guardam só o total e a
  **observação por item** (visível no formulário/detalhe e copiada para a nota); a conversão
  padrão de saída é auxílio de preenchimento e produtos repetidos somam. O pedido `CONFIRMADO`
  sem nota pode ser importado na Saída por `pedidoService.importar` (`nota_saida.criar`):
  destinatário/itens em conferência somente leitura, **uma nota nova** por pedido (1:1),
  validação de destinatário/produtos/quantidades (**nota divergente recusada**), RN001,
  bloqueio por inventário e gravação de `pedido.ID_nota_saida` na mesma transação; o pedido sai
  da importação. Nenhuma nota de entrada/saída aceita produto duplicado
  (`@@unique([id_nota, id_produto])` + serviço). `/pedidos` aceita qualquer permissão do módulo,
  com ações conforme a permissão; lista e relatório `/relatorios/pedidos` filtram
  escola/status/período/produto e **Nota com/sem/todas**, em A4 retrato e CSV. Sem
  Figma/`data-figma`. Release: `npm run db:dedupe-notas`
  (`scripts/dedupe-itens-nota.ts`) em dry-run por padrão; `--apply` grava backup JSON/auditoria
  e consolida duplicados antes do `db push` das uniques.
- **Inventário/contagem (RUN-20261026-81/82 e RUN-20261027-83, RF015/RN005):** abertura por
  produto sobre o estoque achatado em `produto` (`quantidade_sistema = produto.saldo`), com
  bloqueio por produto enquanto `ABERTO`/`EM_CONTAGEM`/`AGUARDANDO_APROVACAO` (exceto a
  movimentação de ajuste do próprio inventário) e recusa de produto já presente em outro
  inventário ativo. Abertura/edição travam os produtos (`SELECT ... FOR UPDATE`) antes da
  checagem; decisão, finalização e cancelamento são transacionais, travam o inventário e não
  ajustam em `CANCELADO`/`FINALIZADO`. Uma contagem por funcionário/item; item sem contagem
  bloqueia o fechamento. A decisão fica em `ItemInventario` (`quantidade_final`, `origem`,
  `id_contagem_inventario`, `decidido_em`, `id_usuario_decisao`): média ou qualquer contagem
  individual, inclusive sem diferença; sem ajuste/movimento quando o valor escolhido é igual ao
  sistema, mas o item fica decidido e o inventário pode finalizar. `AjusteInventario` trocou
  `diferenca` por `quantidade_contada`, `origem` (`MEDIA`/`CONTAGEM`) e
  `id_contagem_inventario`, só existe com diferença e é único por inventário/produto. Aprovação
  altera `produto.saldo` e grava `movimentacao_estoque` com `id_ajuste_inventario`;
  rejeição/cancelamento não alteram saldo nem reserva. Status ganhou `CANCELADO` (com
  `data_fim`), `FINALIZADO` não volta e o fechado continua consultável. Contagem cega é
  funcional: com `Inventario.contagem_cega = true`, só `estoque.ver_saldo` vê sistema/saldos;
  desligada, todos veem (a permissão `inventario.ver_contagem_cega` saiu do seed/UI). Na cega,
  tela, lista, relatório e CSV não revelam sistema, saldos, `quantidade_final` nem a inferência
  de “sem ajuste/igual” sem `estoque.ver_saldo` (lista/CSV seguem com/sem sistema conforme a
  permissão); lista/relatório exigem `relatorio.gerar`. Edição só em `ABERTO` sem contagens;
  exclusão sem contagens/ajustes; depois só cancelar. Edição/exclusão auditam
  produto/quantidade/saldo e produto com item/ajuste de inventário não pode ser excluído.
  Lista impressa sem assinatura, com emitente/data. No dev, o inventário 1 foi backfillado
  (correção local, não é regra de produção).
- **Mural de mensagens no dashboard (KAN-156, RF009):** card próprio no dashboard, antes
  dos gráficos e sem página `/mural`. Qualquer usuário autenticado vê as mensagens ativas
  (manuais e automáticas); quem possui `mural.criar`/`mural.alterar`/`mural.excluir`
  publica, edita e desativa mensagens manuais em modal, com autor, título opcional,
  conteúdo e expiração opcional. As automáticas são somente leitura e levam o selo
  **Sistema**. **Ver anteriores** abre o histórico auditável com as manuais
  desativadas/expiradas e os alertas automáticos anteriores; nada é apagado fisicamente.
  A edição de mensagem já desativada/expirada é recusada no serviço, preservando o
  histórico (RN004).
- **Sino de mensagens novas (KAN-156):** sino no header com a quantidade de mensagens
  ativas publicadas depois da última leitura do usuário. A marca vive no banco
  (`usuario.mural_visto_em`), então vários terminais compartilham o mesmo estado; o
  componente consulta ao montar, a cada 60 s e ao voltar o foco/visibilidade, marca como
  visto no clique e leva a `/dashboard#mural`.
- **Alertas de validade no mural (KAN-140, RN002/RF014):** ao abrir o dashboard, cada
  produto perecível ativo e com validade mantém **uma única mensagem automática ativa**,
  na faixa de 90, 60, 45 ou 30 dias. Ao mudar de faixa, a mensagem anterior é desativada
  (com a chave liberada) e permanece no histórico; produto vencido ou inativo tem a
  mensagem ativa desativada. A geração é idempotente, tolerante a falhas por produto e
  usa o dia civil de São Paulo.
- **Gráficos e indicadores reais no dashboard (KAN-140, KAN-156):** `chart.js` +
  `react-chartjs-2` alimentam três gráficos — movimentações de entrada/saída dos últimos
  seis meses, top 5 produtos por saldo e notas de saída por status. Os KPI
  (itens em estoque, produtos com saldo, saídas pendentes, expedições em percurso e
  perecíveis vencendo em 30 dias) e a lista de pendências usam consultas reais, respeitam
  `estoque.ver_saldo`, `nota_saida.consultar` e as permissões de expedição e mostram estado
  vazio quando não há dados ou permissão.
- **Conversão Padrão de Entrada e Unidade Padrão de Saída no produto (RF010, RF013):**
  `produto.ID_conversao_padrao` (auxílio do lançamento de entrada) e o novo
  `produto.ID_conversao_saida` (auxílio **somente** em notas de saída do tipo Remessa) são
  `NOT NULL DEFAULT 1`; cadastro e visualização mostram os dois campos, com o botão **+**
  abrindo o mesmo `UnidadesModal`. As conversões são auxílio de lançamento e não são copiadas
  para as notas.
- **Nota guarda só totais; conversão é auxílio de lançamento (RF017a, RF017b):**
  `item_nota_entrada` ficou só com `quantidade` (o total que entra no estoque) e
  `item_nota_saida` com `qtd_esperada`/`qtd_entregue` — sem unidade, fator ou quantidade “na
  unidade”. Na Remessa, a Unidade Padrão de Saída aparece apenas no item novo para calcular o
  total; o item existente é editado pelo total guardado. Avaria e Consumo Interno digitam o
  total. As telas de entrada, saída e expedição mostram apenas quantidades/totais.

### Changed

- **Relatórios em A4 retrato (KAN-157):** todos os relatórios — cadastros em ficha,
  movimentação, extrato, auditoria, vencimento, pedidos, expedições e entregas — usam o shell
  `RelatorioCadastro` e a folha A4 retrato, com faixas/cartões e sem colunas espremidas. Os
  helpers `formatarQuantidade`, `contagem` e `montarCsv` centralizam formatação e exportação,
  e o `ImprimirButton` foi movido para `src/components/relatorios/`.
- **Estoque achatado em `produto` (RUN-20261026-80):** a tabela/model `estoque` deixou de
  existir. O saldo passa a ser do produto — `produto.saldo` e `produto.saldo_reservado`
  (`FLOAT NOT NULL DEFAULT 0`, saldo desde a criação) —, com
  `saldo_disponivel = saldo − saldo_reservado`. `item_nota_saida`, `reserva_estoque`,
  `movimentacao_estoque`, `item_coleta`, `item_inventario` e `ajuste_inventario` passaram de
  `ID_estoque` para `ID_produto` (FK e relação `produto`), sem linha de estoque/lote,
  `data_entrada` nem `ativo` de estoque (a data fica no histórico de movimentações e a
  atividade é `produto.ativo`). A migração no dev consolidou as linhas ativas por produto
  (`saldo = SUM(quantidade_atual)`, `saldo_reservado = SUM(saldo_reservado)`), deu zero aos
  produtos sem linha e remapeou os registros históricos; o backfill de produção fica para o
  release (o projeto não versiona migrations — SQL de backfill + `db push`). No código,
  `src/dao/estoque.ts` passou a expor `SaldoDAO`/`saldoDAO`; dashboard, relatórios e listagens
  leem `produto.saldo`/`saldo_reservado`. RN001 (aviso sem bloqueio), reserva, baixa,
  cancelamento, histórico `saldo_anterior`/`saldo_posterior` e auditoria permanecem. O
  inventário (RF015) será implementado no run seguinte sobre essa base; a coluna
  `ajuste_inventario.diferenca` ainda existe e será revista então. Validação: `npm test` (35
  arquivos, 422 testes), `npm run lint`, `npm run build` e `npm run figma:check` — sem commit.
- **Tela de permissões (KAN-140):** o painel de perfis/usuários deixou a transfer-list de
  duas colunas e passou a usar uma lista única de grupos com busca, chevron, switches por
  grupo e por ação e contador de selecionadas. O modal de perfil ganhou título por modo,
  Nome/Descrição acima e permissões em largura total; o formulário de usuário mantém o
  layout de duas colunas e o “Aplicar perfil”. Sem mudança de backend ou regra.
- **Dashboard:** os valores estáticos de KPI e de pendências foram substituídos por dados
  reais; a ordem da tela passou a ser título → KPI → mural → gráficos → pendências.
- **Banco de dados:** `mensagem_mural.chave` (única, usada pela mensagem automática ativa;
  nula no histórico e nas manuais) e `usuario.mural_visto_em` (marca de leitura do mural).
  Aplicados no banco de desenvolvimento com `prisma db push`; a produção depende da
  próxima release.
- **Cobertura:** `tests/dao/mural.test.ts`, `tests/dao/dashboard.test.ts`,
  `tests/services/mural.test.ts` e `tests/services/alerta-validade.test.ts` cobrem
  ativas/histórico, imutabilidade, permissões de leitura, sino, faixas 90/60/45/30,
  idempotência, troca de faixa, produto vencido/inativo e as agregações do dashboard.
- **Semântica das unidades corrigida (RF010–RF017b):** a conversão é **auxílio de lançamento**
  (não a unidade do produto, do saldo ou da nota); estoque, reserva, baixa e movimentação ficam
  em base (`UNIDADE`, fator 1). Dashboard, relatórios, CSV, listagens e seletores perderam a
  coluna/rótulo **Unidade**; entrada, saída e expedição não exibem unidade, fator, “base” ou
  “convertida”.
- **Exclusão de unidade:** revincula à unidade padrão os produtos pelos **dois** vínculos
  (`ID_conversao_padrao` e `ID_conversao_saida`) e registra na auditoria
  `produtos_revinculados`, `produtos_revinculados_entrada` e `produtos_revinculados_saida`.
- **Banco de dados (unidades):** `produto.ID_conversao_saida` (`NOT NULL DEFAULT 1`) e default 1
  em `produto.ID_conversao_padrao`; as notas **não guardam conversão** — `item_nota_entrada`
  ficou só com `quantidade` e `item_nota_saida` com `qtd_esperada`/`qtd_entregue`, e as colunas
  de conversão que chegaram a existir no ciclo (`item_nota_entrada.fator_conversao`/
  `quantidade_convertida`, `item_nota_saida.unidade_saida`/`fator_conversao`/
  `quantidade_solicitada`) foram removidas. O backfill
  (`item_nota_entrada.quantidade = quantidade_convertida`) foi feito no desenvolvimento antes
  do drop, aplicado com `prisma db push`; a produção depende da próxima release.
- **Cobertura (unidades):** `tests/services/nota-saida.test.ts` cobre o total na Remessa, o
  auxílio no item novo, Avaria/Consumo e nota antiga; `tests/services/nota-entrada.test.ts`
  cobre o total na criação e a edição de item existente e de nota antiga (pós-backfill);
  `tests/dao/produto.test.ts` e `tests/dao/conversao-unidade.test.ts` cobrem os dois vínculos e
  a revinculação na exclusão; `tests/dao/dashboard.test.ts`, `tests/dao/relatorio.test.ts`,
  `tests/services/relatorio.test.ts` e `tests/lib/produto-linha.test.ts` cobrem a ausência da
  unidade nas telas e nos CSV.

## [4.24.10.2026] - 2026-10-24

Esta seção consolida o CNPJ de pessoa jurídica: `VARCHAR(14)` com validação e máscara,
a consulta na BrasilAPI para preencher fornecedor/destinatário e o novo campo
`nome_fantasia`.

### Added

- **Lib e campo compartilhado de CNPJ (KAN-138, KAN-154):** `src/lib/cnpj.ts` centraliza
  `apenasDigitosCnpj`, a formatação progressiva `00.000.000/0000-00` e a validação (14 dígitos,
  sequências repetidas e dígitos verificadores), e `src/components/CnpjField.tsx` é usado pelos
  formulários de fornecedor e de destinatário. Cobertura em `tests/lib/cnpj.test.ts`.
  (KAN-138, KAN-154)
- **Consulta de CNPJ na BrasilAPI e nome fantasia de pessoa jurídica (KAN-138, KAN-154):** o
  botão **Consultar** ao lado do CNPJ (fornecedor e destinatário, criação e edição) consulta
  `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}` e preenche **razão social**, **nome
  fantasia** e **endereço completo, incluindo número**. A consulta valida o CNPJ no cliente e
  no serviço antes da chamada, envia `User-Agent` próprio (`Nexus/3.24.10.2026`) — o padrão do
  Node é bloqueado —, usa timeout de 8 s e cache em memória de 1 h por CNPJ (só sucesso).
  **Sobrescreve** razão social, nome fantasia e endereço com o retorno da API e **não**
  preenche e-mail/telefone; o usuário revisa antes de salvar. Situação cadastral diferente de
  `ATIVA` **avisa sem bloquear**. 404 → "CNPJ não encontrado na Receita."; 403/429 → consulta
  temporariamente indisponível; demais falhas → mensagem genérica. `pessoa_juridica` recebe
  `nome_fantasia` (banco, tipos, Server Actions, DAOs e auditoria), exibido nos modais de
  fornecedor e destinatário; relatórios e listagens não foram alterados. Cobertura em
  `tests/services/consulta-cnpj.test.ts` e nos testes de DAO. (KAN-138, KAN-154)

### Changed

- **CNPJ de fornecedores e destinatários em `VARCHAR(14)`, só dígitos, com validação e máscara
  (KAN-138, KAN-154):** a coluna `pessoa_juridica.cnpj` passou de `VARCHAR(191)` para
  `VARCHAR(14)` e grava apenas os dígitos. O cadastro e a edição aplicam a máscara
  `00.000.000/0000-00` ao digitar, a visualização (modal, relatórios de fornecedores e de
  destinatários e seletor de fornecedor da entrada) exibe o CNPJ formatado e as Server Actions
  recusam CNPJ com quantidade diferente de 14 dígitos, sequência repetida ou dígitos
  verificadores inválidos; vazio continua permitido e a duplicidade mantém a mensagem de
  unicidade. O CSV dos relatórios segue com os dígitos puros. Antes do `db push` no banco de
  desenvolvimento (`nexus`) os dados foram normalizados: 3 registros de pessoa jurídica, 1 com
  CNPJ preenchido — inválido, zerado —, 0 duplicados; nenhum CNPJ válido permaneceu e os 3
  registros ficaram sem CNPJ. (KAN-138, KAN-154)

## [3.24.10.2026] - 2026-10-24

Esta seção consolida as correções desde `2.24.10.2026`: CPF do funcionário
(`VARCHAR(11)`, validação e máscara), remoção de `fornecedor.contato`, impressão dos
relatórios e imagens de produtos em produção (rota runtime).

### Changed

- **CPF do funcionário em `VARCHAR(11)`, só dígitos, com validação e máscara (KAN-153):** a
  coluna `pessoa_fisica.cpf` passou de `VARCHAR(191)` para `VARCHAR(11)` e grava apenas os
  dígitos. O cadastro e a edição aplicam a máscara `000.000.000-00` ao digitar, a visualização
  (modal e relatório de funcionários) exibe o CPF formatado e as Server Actions recusam CPF
  com quantidade diferente de 11 dígitos, sequência repetida ou dígitos verificadores
  inválidos; vazio continua permitido e a duplicidade mantém a mensagem de unicidade. O CSV
  do relatório segue com os dígitos puros. Os CPFs do banco de desenvolvimento foram
  normalizados antes do `db push`: 2 registros, ambos já corretos — nenhum inválido ou
  duplicado zerado. (KAN-153)

### Removed

- **Campo `fornecedor.contato` (texto livre) removido do banco e do cadastro:** a coluna
  `contato` foi retirada de `fornecedor` no `prisma/schema.prisma` e do banco de
  desenvolvimento (`prisma db push`). O campo **Contato** saiu do modal de fornecedor
  (novo/editar/visualizar), das Server Actions (`FornecedorFormData`, criação e edição),
  do DAO e dos snapshots de auditoria (`dados_anteriores`/`dados_novos`); diagramas e
  entendimento atualizados. Os contatos estruturados `fornecedor_email` e
  `fornecedor_telefone` (seção **Contatos** do modal) permanecem inalterados. (Decisão do
  usuário, 2026-10-24 — sem chave de issue.)

### Fixed

- **Imagens de produtos em produção (KAN-139):** o upload gravava a imagem em
  `public/uploads/produtos/{id}/...` e atualizava `produto.foto_url`, mas a URL respondia
  **404** no `next start`: o Next serve o `public` existente no build e não enxerga
  arquivos adicionados em runtime (no `next dev` funcionava). Uma rota runtime
  `GET /uploads/[...path]` passou a ler o arquivo do disco a cada requisição, com
  `Content-Type` por extensão, cache imutável e `404` para caminho inválido ou inexistente;
  o `proxy.ts` continua exigindo sessão para `/uploads`. O armazenamento dos uploads e o
  banco não mudaram.
- **Impressão dos relatórios (KAN-143):** no `@media print`, o grid do shell perdia as
  colunas apenas na aparência — com a sidebar oculta, o `main` caía na primeira coluna
  (largura da sidebar) e o relatório saía espremido à esquerda. A impressão agora
  transforma o grid em bloco, zera padding/overflow do `main` e o relatório ocupa a
  largura útil do A4, fluindo entre páginas.
- **CPF e cargo do funcionário no formulário (KAN-153):** ao editar um funcionário, os
  campos **CPF** e **Cargo** abriam em branco, porque os inputs dependiam de um estado que
  não existia; passaram a ser controlados e inicializados com os dados do funcionário
  (visualização e criação inalteradas). O **CPF** também não era enviado pela Server Action
  de edição nem gravado pelo DAO — agora é salvo em `pessoa_fisica.cpf` e a alteração
  registra auditoria `PessoaFisica`/`ALTERAR` com os snapshots antes/depois (`nome`, `cpf`),
  mantendo a auditoria de `Funcionario`.

## [2.24.10.2026] - 2026-10-24

Esta seção consolida os relatórios complementares (KAN-143, KAN-159–KAN-163), o shell
em grid e os ajustes da saída e da expedição (KAN-140).

### Added

- **Adicionar notas à expedição em duas colunas (KAN-140):** o seletor de notas da
  expedição passou a mostrar as **remessas elegíveis** à esquerda — tipo Remessa, fora
  de expedições ativas e não baixadas/canceladas (a baixa parcial com saldo pendente
  continua elegível, RN003) — e as **notas já na expedição** à direita, com busca por
  código/destinatário, paginação e adição sem fechar o modal; a ordem segue ajustável na
  lista da expedição.
- **Relatório de Auditoria (RF023/RF024):** `/relatorios/auditoria` lista a trilha de auditoria (`registro_auditoria`) com **Data/hora**, **Usuário**, **Ação**, **Entidade** e **Registro** afetado, em ordem decrescente de data e com o total de registros. Os filtros são **Usuário** (somente ativos), **Entidade** e **Ação** em multi-seleção — as duas últimas com as opções distintas da própria trilha — além do **Período** com De/Até e atalhos; sem busca livre. Layout A4 para impressão/PDF, permissão `relatorio.gerar` e exportação CSV (BOM, `;`, decimal com vírgula) com os mesmos filtros e colunas; o hub `/relatorios` ganhou o card.
- **Relatórios de Funcionários, Destinatários e Fornecedores (KAN-160, KAN-162, KAN-163, RF023/RF024):** `/relatorios/funcionarios` lista os funcionários com código, nome, CPF, cargo, condutor, situação e e-mail/telefone principais, com filtro de **Situação** em multi-seleção. `/relatorios/destinatarios` lista escolas e creches com código, razão social, CNPJ, tipo, situação, endereço e contato principal, filtrando por **Situação** e **Tipo**. `/relatorios/fornecedores` lista os fornecedores com código, razão social, CNPJ, situação, endereço e contato principal, com filtro de **Situação**. Os três usam a barra de filtros com chips, layout A4 para impressão/PDF e exportação CSV (BOM, `;`, decimal com vírgula); o hub `/relatorios` ganhou os respectivos cards.
- **Relatório de Produtos Próximos ao Vencimento (RF023/RF024):** `/relatorios/vencimento` lista somente produtos perecíveis com `data_validade` preenchida, ordenados pela validade, com código, produto, unidade, quantidade, validade, dias restantes e situação (`Vencido (N)`, `Vence hoje`, `Vence em N` ou `OK`), além dos totais de itens e vencidos. O filtro **Dias para vencer** (30/60/90/120/Todos) limita pela data de validade e inclui os já vencidos. Layout A4 para impressão/PDF e CSV com os mesmos filtros e colunas; o hub `/relatorios` ganhou o card.
- **Relatório de Movimentação de Estoque e Extrato de Produto (KAN-161, RF023):** `/relatorios/movimentacao` lista as movimentações do período (padrão: mês atual, fuso de São Paulo) com filtros por produto e tipo (entradas/saídas/todas), sem busca livre. As linhas vêm em ordem cronológica com produto, tipo (Entrada/Saída/Ajuste), documento (`NE #`/`NS #`/`—`), quantidade, saldo anterior/posterior, usuário e observação, e o rodapé da tabela totaliza entradas e saídas. A tela tem layout A4 para impressão/PDF e exportação CSV (BOM, `;`, decimal com vírgula). Com `?produto=<id>` a mesma tela vira o **Extrato de Produto**, com o produto no cabeçalho. O hub `/relatorios` ganhou os cards dos dois relatórios.
- **Expedições por Período e Entregas por Instituição (RF023):** `/relatorios/expedicoes` lista as expedições com `data_prevista` no período (padrão: mês atual) e filtros em select por expedição, destinatário, condutor e status (planejada/em percurso/concluída/todas), sem busca livre. A tabela traz data prevista, status, veículo, condutor, notas, destinatários, itens esperados e itens entregues, em ordem decrescente de data, com totais de notas e itens. `/relatorios/entregas` lista as notas de saída por destinatário no período (`data_criacao`) com filtro de status da nota, e traz nota, data, destinatário, status, itens, esperado, entregue, pendente (`Σ(qtd_esperada − qtd_entregue)`) e a expedição do vínculo mais recente, com totais de esperado/entregue/pendente. As duas telas seguem o layout A4 dos demais relatórios, com impressão/PDF e CSV com BOM, `;` e decimal com vírgula; o hub `/relatorios` ganhou os respectivos cards.

### Changed

- **Shell em grid com sidebar rail e logo fixa (KAN-140):** o shell passou para o layout
  raiz e foi reorganizado em grid — sidebar com ícones lucide, rail de 72px, grupos
  recolhíveis com estado persistido e botão de recolher dentro dela; header em largura
  total com a logo horizontal (`logo_horizontal.svg`), que mantém a largura da sidebar
  aberta enquanto o conteúdo anima entre 256px e 72px.
- **Título da página saiu do cabeçalho (KAN-140):** o título agora é renderizado no
  topo-esquerdo de cada página (`PageTitle`), mantendo o título próprio das telas de
  relatórios; o header ficou só com as ações (configurações, notificações e usuário).
- **Filtros dos relatórios em barra de chips com múltipla seleção (RF023):** `/relatorios/movimentacao`, `/relatorios/expedicoes` e `/relatorios/entregas` deixaram os selects soltos e passaram a usar uma barra de filtros com chips (ícone, rótulo, valor e X para remover), botão tracejado **Adicionar filtro** e painel de checkboxes para selecionar mais de uma entidade. O período tem De/Até com os atalhos **Mês atual** e **Semestre atual** (fuso `America/Sao_Paulo`); **Aplicar filtros** leva a seleção para a URL e **Limpar** volta ao padrão do relatório. Os filtros multivalor viajam como lista separada por vírgula (`produto=1,2`) e o CSV carrega exatamente os filtros ativos. No domínio, os filtros passaram a ser arrays (`id_produtos`, `id_destinatarios`, `id_fornecedores`, `tipos`, `id_expedicoes`, `id_condutores`, `status`) aplicados com `in` no Prisma; lista vazia não filtra. Sem busca livre e sem dependência nova. O modo **Extrato de Produto** (`?produto=<id>`) continua valendo quando há exatamente um produto selecionado.
- **Relatório de Movimentação único, com os filtros do usuário (RF023):** não há mais relatórios separados de movimentação/consolidado. `/relatorios/movimentacao` passou a ter também os filtros **destinatário** e **fornecedor** (selects, sem busca livre), ao lado de período, produto e tipo, e a coluna **Destinatário / Fornecedor** — o destinatário da saída ou o fornecedor da entrada, com `—` quando não houver. O semestre é só um recorte de período: atalhos **Mês atual** e **Semestre atual** preenchem `de`/`até` preservando os demais filtros. O CSV/exportação leva os mesmos filtros e colunas.
- **Lista de Produtos filtra apenas por situação:** o relatório de produtos (`/relatorios/produtos` e o CSV) deixou de ter busca por código/descrição; o filtro no servidor é só por situação (ativas/inativas/todas).

### Fixed

- **Coluna Itens da listagem de saída (KAN-140):** passou a mostrar a soma das
  quantidades da nota (ex.: itens de 10 e 5 → 15) em vez da representação da lista de
  itens; o total usa a soma de `qtd_esperada` já calculada em `listarNotasSaida`.

## [1.24.10.2026] - 2026-10-24

Esta seção consolida a entrega da movimentação de estoque (KAN-140), o relatório de
Lista de Produtos (KAN-159) e as decisões de modelagem e documentação que as sustentam.

### Added

- **Nota de saída como entrega, com tipo de saída e unidade padrão (KAN-140):** a nota de
  saída virou o documento central da entrega — com destinatário (obrigatório para
  Remessa), itens e reserva — e ganhou o campo **Tipo de Saída**: Remessa, Avaria e
  Consumo Interno. Remessa reserva estoque ao ser criada; Avaria e Consumo Interno não
  têm destinatário, não reservam e dão baixa real na criação, com movimentação negativa
  e nota nascida `BAIXA_TOTAL`. O cadastro de unidades ganhou a unidade padrão do
  sistema (`UNIDADE`, fator 1), que não pode ser excluída nem ter nome ou fator
  alterados, e todo produto passa a ter unidade obrigatória — ao excluir uma unidade que
  não é a padrão, os produtos que a usavam são revinculados à padrão. Saldo insuficiente
  continua apenas avisando (RN001).
- **Movimentação de estoque — entrada e saída (KAN-140):** novo módulo em `/mov-estoque`
  com abas Entrada e Saída. A entrada registra nota com fornecedor, data de recebimento,
  chave de acesso NF-e opcional e itens com conversão de unidade; em transação única
  grava nota, itens, atualização de `quantidade_atual`, movimentação de estoque e
  auditoria. A saída cria a nota de entrega (Remessa) com reserva do estoque
  (`saldo_reservado += quantidade`), urgência, condutor e veículo; saldo insuficiente só
  avisa (RN001). Ambas as notas têm visualização e edição validadas no servidor — a
  edição corrige estoque/reserva pelo delta, sempre em transação com auditoria
  antes/depois — e não permitem remover item nem excluir a nota (RN004). A entrada
  confirmada é imutável.
- **Expedições, percursos, execução da entrega e baixa (KAN-140):** as expedições montam
  o manifesto da entrega — veículo, condutor e data prevista obrigatórios — com as notas
  e a ordem das visitas baseada em percursos cadastrados (`/expedicoes/percursos`, com
  nome único e ordem editável). Em percurso, cada nota tem **Registrar entrega** (com
  entrega parcial e corte do restante) e o cabeçalho tem **Concluir expedição**. A baixa
  roda em transação única: `quantidade_atual` e `saldo_reservado` caem pelo delta
  entregue e a movimentação é gravada; status da nota vira `BAIXA_TOTAL`, `BAIXA_PARCIAL`
  (restante segue para outra expedição — RN003) ou `BAIXA_COM_CORTE`; cancelamento da
  nota libera a reserva em transação idempotente (RN004).
- **Relatórios — módulo e Lista de Produtos (KAN-157–KAN-163, KAN-159):** novo hub
  `/relatorios` e o relatório de Lista de Produtos implementado, com filtros aplicados no
  servidor (busca por código/descrição e situação), permissão `relatorio.gerar`, layout
  A4 conforme os templates do PR #4 e exportação CSV com BOM UTF-8, separador `;` e
  decimal com vírgula (RF024).
- **Formulários de issue para erro e melhoria (KAN-140):** formulários de issue
  padronizados (bug e melhoria) no repositório, para orientar o reporte com contexto de
  versão, passos de reprodução e resultado esperado.
- **Catálogo de permissões atualizado (KAN-140):** as permissões de `remessa.*` deram
  lugar às de `nota_saida.*` (`criar`, `alterar`, `consultar`, `cancelar`,
  `alterar_status`, `finalizar`) e à nova `percurso.excluir`; o seed é idempotente e o
  catálogo final ficou com **77** permissões.

### Changed

- **Nota de saída e remessa fundidas em um só nível (KAN-140):** por decisão do usuário
  de 2026-10-23, a nota de saída passou a ser a própria entrega — carrega destinatário,
  itens, reserva e status — e a expedição virou o manifesto. Saíram do schema `Remessa`,
  `ItemRemessa` e `StatusRemessa`; `StatusNotaSaida` agora é `ABERTA`, `EM_PERCURSO`,
  `PENDENTE`, `BAIXA_TOTAL`, `BAIXA_PARCIAL`, `BAIXA_COM_CORTE` e `CANCELADA`; a reserva
  passou a pertencer à nota (antes `ID_remessa`; antes disso `ID_nota_saida`). A RN003
  passou a apontar a própria nota em `BAIXA_PARCIAL` como a pendência da entrega parcial
  (sem *split* e sem tabela nova). Diagramas e documentos de domínio alinhados.
- **Rota virou expedição e percurso passou a ser excluído fisicamente (KAN-140):** o
  conceito de organização das entregas foi renomeado para **expedição**, inclusive no
  modelo físico (`expedicao`, `expedicao_nota`, `StatusExpedicao`), e o status de veículo
  em deslocamento virou `EM_EXPEDICAO`. `expedicao` deixou de guardar `ID_percurso` — o
  percurso é apenas um atalho de ordenação na montagem — e `percurso` deixou de ter
  `ativo`: a exclusão é física, com o snapshot anterior na auditoria.
- **Chave de acesso da NF-e vira coluna da nota de entrada (KAN-140):** a tabela
  `nota_entrada_chave_acesso` deixou de existir; a chave passou a ser a coluna nullable
  e única `nota_entrada.chave_acesso VARCHAR(44)` — a nota tem no máximo uma chave. As
  chaves existentes foram transportadas antes da queda da tabela.
- **A nota de saída passa a consolidar pedidos (FK invertida):** o vínculo migrou de
  `nota_saida.ID_pedido_escola` para `pedido_escola.ID_nota_saida` — uma nota agrega
  **N** pedidos e cada pedido pertence a no máximo uma nota. (Decisão do usuário,
  2026-10-19 — sem chave de issue.)
- **Documentação reorganizada e requisitos alinhados:** `docs/` reorganizado por assunto
  (`dominio/`, `processo/`, `diagramas/`, com novo `docs/README.md` e
  `docs/dominio/IMPLEMENTACAO.md`), com divergências contra o código corrigidas
  (ENTENDIMENTO, diagramas de classes e DER, AGENTS.md, README.md e JIRA.md). As
  prioridades dos requisitos foram alinhadas à realidade operacional (RF009/RF013/
  RF016/RF024/RNF002 → Essencial), o RF008 foi registrado como lacuna intencional, os
  requisitos fora de escopo foram isolados em `docs/dominio/ESCOPO_FORA.md` (RF026 — NF-e,
  RNF009 e o RF018 — Kanban — com justificativa) e o `mensagem_mural.ID_usuario` passou a
  ser opcional para permitir mensagens automáticas do mural (RN002/RF014). (Decisões do
  usuário de 2026-10-19 — sem chave de issue.)

### Removed

- **`anexo.ID_documento_fiscal` removida do modelo:** a coluna era órfã — não existe
  modelo `documento_fiscal`, não há FK e nenhum código em `src/**` a lê ou escreve. A
  remoção foi precedida da conferência no banco, que deu **0** linhas com valor não nulo.
  (Decisão do usuário, 2026-10-19 — sem chave de issue.)
- **`nota_saida.ID_destinatario` removida do modelo (e revertida pela fusão):** a coluna
  saiu em 2026-10-19, mas com a fusão nota/remessa (2026-10-23) `ID_destinatario` voltou
  à nota de saída como FK opcional, obrigatória para o tipo Remessa, já que a nota
  passou a ser a entrega. A remoção original foi precedida de conferência no banco (1
  linha não nula, em 4 notas). (Decisões do usuário — sem chave de issue.)


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
-->
