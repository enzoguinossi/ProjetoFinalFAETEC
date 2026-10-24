# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

A convenção completa — como numerar releases do mesmo dia, como escrever uma entrada e a
rastreabilidade versão ↔ issues ↔ commit — está em
[`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md). O checklist de release está em
`.opencode/skills/release/SKILL.md`.

## [Unreleased]

### Added

- **Relatório de Auditoria (RF023/RF024):** `/relatorios/auditoria` lista a trilha de auditoria (`registro_auditoria`) com **Data/hora**, **Usuário**, **Ação**, **Entidade** e **Registro** afetado, em ordem decrescente de data e com o total de registros. Os filtros são **Usuário** (somente ativos), **Entidade** e **Ação** em multi-seleção — as duas últimas com as opções distintas da própria trilha — além do **Período** com De/Até e atalhos; sem busca livre. Layout A4 para impressão/PDF, permissão `relatorio.gerar` e exportação CSV (BOM, `;`, decimal com vírgula) com os mesmos filtros e colunas; o hub `/relatorios` ganhou o card.
- **Relatórios de Funcionários, Destinatários e Fornecedores (KAN-160, KAN-162, KAN-163, RF023/RF024):** `/relatorios/funcionarios` lista os funcionários com código, nome, CPF, cargo, condutor, situação e e-mail/telefone principais, com filtro de **Situação** em multi-seleção. `/relatorios/destinatarios` lista escolas e creches com código, razão social, CNPJ, tipo, situação, endereço e contato principal, filtrando por **Situação** e **Tipo**. `/relatorios/fornecedores` lista os fornecedores com código, razão social, CNPJ, situação, endereço e contato principal, com filtro de **Situação**. Os três usam a barra de filtros com chips, layout A4 para impressão/PDF e exportação CSV (BOM, `;`, decimal com vírgula); o hub `/relatorios` ganhou os respectivos cards.
- **Relatório de Produtos Próximos ao Vencimento (RF023/RF024):** `/relatorios/vencimento` lista somente produtos perecíveis com `data_validade` preenchida, ordenados pela validade, com código, produto, unidade, quantidade, validade, dias restantes e situação (`Vencido (N)`, `Vence hoje`, `Vence em N` ou `OK`), além dos totais de itens e vencidos. O filtro **Dias para vencer** (30/60/90/120/Todos) limita pela data de validade e inclui os já vencidos. Layout A4 para impressão/PDF e CSV com os mesmos filtros e colunas; o hub `/relatorios` ganhou o card.
- **Relatório de Movimentação de Estoque e Extrato de Produto (KAN-161, RF023):** `/relatorios/movimentacao` lista as movimentações do período (padrão: mês atual, fuso de São Paulo) com filtros por produto e tipo (entradas/saídas/todas), sem busca livre. As linhas vêm em ordem cronológica com produto, tipo (Entrada/Saída/Ajuste), documento (`NE #`/`NS #`/`—`), quantidade, saldo anterior/posterior, usuário e observação, e o rodapé da tabela totaliza entradas e saídas. A tela tem layout A4 para impressão/PDF e exportação CSV (BOM, `;`, decimal com vírgula). Com `?produto=<id>` a mesma tela vira o **Extrato de Produto**, com o produto no cabeçalho. O hub `/relatorios` ganhou os cards dos dois relatórios.
- **Expedições por Período e Entregas por Instituição (RF023):** `/relatorios/expedicoes` lista as expedições com `data_prevista` no período (padrão: mês atual) e filtros em select por expedição, destinatário, condutor e status (planejada/em percurso/concluída/todas), sem busca livre. A tabela traz data prevista, status, veículo, condutor, notas, destinatários, itens esperados e itens entregues, em ordem decrescente de data, com totais de notas e itens. `/relatorios/entregas` lista as notas de saída por destinatário no período (`data_criacao`) com filtro de status da nota, e traz nota, data, destinatário, status, itens, esperado, entregue, pendente (`Σ(qtd_esperada − qtd_entregue)`) e a expedição do vínculo mais recente, com totais de esperado/entregue/pendente. As duas telas seguem o layout A4 dos demais relatórios, com impressão/PDF e CSV com BOM, `;` e decimal com vírgula; o hub `/relatorios` ganhou os respectivos cards.

### Changed

- **Filtros dos relatórios em barra de chips com múltipla seleção (RF023):** `/relatorios/movimentacao`, `/relatorios/expedicoes` e `/relatorios/entregas` deixaram os selects soltos e passaram a usar uma barra de filtros com chips (ícone, rótulo, valor e X para remover), botão tracejado **Adicionar filtro** e painel de checkboxes para selecionar mais de uma entidade. O período tem De/Até com os atalhos **Mês atual** e **Semestre atual** (fuso `America/Sao_Paulo`); **Aplicar filtros** leva a seleção para a URL e **Limpar** volta ao padrão do relatório. Os filtros multivalor viajam como lista separada por vírgula (`produto=1,2`) e o CSV carrega exatamente os filtros ativos. No domínio, os filtros passaram a ser arrays (`id_produtos`, `id_destinatarios`, `id_fornecedores`, `tipos`, `id_expedicoes`, `id_condutores`, `status`) aplicados com `in` no Prisma; lista vazia não filtra. Sem busca livre e sem dependência nova. O modo **Extrato de Produto** (`?produto=<id>`) continua valendo quando há exatamente um produto selecionado.
- **Relatório de Movimentação único, com os filtros do usuário (RF023):** não há mais relatórios separados de movimentação/consolidado. `/relatorios/movimentacao` passou a ter também os filtros **destinatário** e **fornecedor** (selects, sem busca livre), ao lado de período, produto e tipo, e a coluna **Destinatário / Fornecedor** — o destinatário da saída ou o fornecedor da entrada, com `—` quando não houver. O semestre é só um recorte de período: atalhos **Mês atual** e **Semestre atual** preenchem `de`/`até` preservando os demais filtros. O CSV/exportação leva os mesmos filtros e colunas.
- **Lista de Produtos filtra apenas por situação:** o relatório de produtos (`/relatorios/produtos` e o CSV) deixou de ter busca por código/descrição; o filtro no servidor é só por situação (ativas/inativas/todas).

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
  requisitos fora de escopo foram isolados em `docs/dominio/ESCOPO_FORA.md` (RF025,
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
Próximo release: sem data marcada — depende de o sistema ganhar telas para os módulos que
ficaram fora de 1.17.10.2026 (estoque, notas, remessas e rotas, inventário, mural e relatórios).
-->
