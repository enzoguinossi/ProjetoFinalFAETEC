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

<!-- Nada pendente desde a 1.17.10.2026 — a primeira versão do projeto. -->

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
- **Testes:** 18 arquivos e 165 testes cobrindo DAOs, serviços e b ibliotecas (`npm test`,
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
