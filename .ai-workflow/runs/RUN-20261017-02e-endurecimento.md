# Contrato de Tarefa — RUN-20261017-02e (endurecimento pós-revisão)

Parte de `RUN-20261017-02` (KAN-166). Delegado pelo Orquestrador ao agente `developer`.
Achados vêm da revisão independente (`reviewer`) e do QA; os que o Orquestrador confirmou
por leitura estão marcados **[confirmado]**.

## Identificação

- **Run ID:** `RUN-20261017-02e`
- **Agente executor:** `developer`
- **Profundidade de delegação:** `1/2`
- **Branch/worktree:** `figma-export`
- **Commit-base:** `e27c3ec`

## Correções (em ordem de prioridade)

### 1. **[confirmado] `catch` sem binding usando `erro` — bug**
`tools/figma-export/plugin/code.js:2226` e `:2346`: `catch {` (sem binding) e depois
`textoDoErro(erro)` → `ReferenceError`, que **derruba a importação inteira** e mascara o
erro real (contradiz o contrato de "falha registrada, nunca silenciosa" do MAPA §3/§8).
Corrigir para `catch (erro)` (ou capturar o erro corretamente). O `figma:check` não pega
isso (o mock sempre responde 200 e a colheita completa não falha) → **acrescentar
invariante** que force (a) uma cena a falhar e (b) um `/verify` a falhar, e exija que a
importação **continue** e registre a falha com a mensagem real.

### 2. **[confirmado] Manifesto lista cenas não capturadas**
`harvest.ts` monta `scenes: escopo.map(...)` incluindo cenários que falharam a captura;
`plugin-check.ts` faz `readFileSync` sem `existsSync` → `ENOENT` (o revisor reproduziu
durante uma colheita parcial). Fazer o manifesto conter **apenas as cenas efetivamente
capturadas** e, nos consumidores (`plugin-check.ts`), falhar com mensagem clara
("rode `npm run figma:harvest`") em vez de estourar. Invariante se fizer sentido.

### 3. Servidor local escuta em todas as interfaces
`server.ts:168` — `servidor.listen(SERVER_PORT)` sem host (liga em `0.0.0.0`/`::`) com
`Access-Control-Allow-Origin: *` e escrita **sem autenticação** (`POST /verify`,
`POST /snapshot`). Passar a escutar em **`127.0.0.1`**. (`caminhoSeguro` já bloqueia
path traversal — manter.)

### 4. Guarda de banco inexistente
`fixtures.ts` faz `deleteMany()` em massa (inclui `registroAuditoria`) — aceitável só
porque roda no banco isolado. Não há proteção se `DATABASE_URL`/`FIGMA_EXPORT_DATABASE_URL`
apontarem para o banco de desenvolvimento. Adicionar **recusa explícita**: se o nome do
banco derivado for igual ao do banco-base, abortar com mensagem clara. `GUARD_RESET` e
`exportDbEnv` (`config.ts`) existem e não são usados — usar ou remover (não deixar código
morto sugerindo proteção).

### 5. Invariantes #15/#16 mais fracas do que o MAPA §6 promete
`plugin-check.ts` valida `grow` **só na cena**, não na árvore construída — um bug do plugin
que pusesse dois `layoutGrow` (o defeito que a #15 existe para travar) **passaria**.
Estender #15/#16 à **árvore do mock**. E fazer #17/#18 **falharem** quando não encontram o
alvo do pareamento (hoje `j++; continue` pula em silêncio → falso negativo).

### 6. Documentação
- `CHANGELOG.md`: "com 14 invariantes" → **18**; e a frase sobre `src/**` dizer que houve
  **mudança visual pretendida** (Inter) além das marcas aditivas — hoje diz só "aditivo".
- `tools/figma-export/MAPA.md §9`: remover a pendência obsoleta ("re-importar e rodar
  `figma:compare`") e registrar a 3ª medição (**2,421%**); registrar como limitação aceita
  que **2 telas** usam `monospace` (`LoginForm.tsx`, "V1.0.0") e o plugin mapeia para Inter.
- `plugin-check.ts`: numeração de comentários dos blocos de invariante (hoje há dois `13)` e
  um `14)`) — alinhar com a tabela do MAPA.

## Escopo

- **Pode alterar:** `tools/figma-export/{harvest.ts,server.ts,fixtures.ts,config.ts,plugin/code.js,plugin-check.ts,MAPA.md}`, `CHANGELOG.md`.
- **Não tocar:** `src/**`, `prisma/**`, `compare.ts`, `dom-walker.js`, `diff.ts`, `tokens.ts`.

## Método e critérios de aceite

- Cada correção com teste/invariante quando aplicável; **prove os dentes** (reintroduza o
  defeito, veja falhar, desfaça preservando os bytes originais).
- `npm run figma:harvest` 47/47 · `npm run figma:check` **verde** · `npx tsc --noEmit` ·
  `npx eslint` nos arquivos alterados.
- Commit com **KAN-166**; preencher o Resultado; sem push.

## Resultado (preenchido pelo executor)

- **Status:** concluído
- **Achados corrigidos e como:**
  1. **[bug confirmado]** `plugin/code.js` — `catch {` → `catch (erro)` nos dois pontos
     (`montarCena`/`/verify` e o laço das cenas). O `textoDoErro(erro)` lançava
     `ReferenceError` **dentro** do `catch`, derrubando a importação e mascarando a causa.
  2. **Manifesto parcial** — `harvest.ts` passou a listar só as cenas capturadas
     (`escopo.filter((c) => capturadas.has(c.id))`); `plugin-check.ts` confere a existência de
     `cena.file` e `cena.refImage` e **aborta com mensagem clara** ("Rode: npm run figma:harvest")
     em vez de estourar `ENOENT`.
  3. **Servidor** — `server.ts`: `listen(SERVER_PORT, "127.0.0.1")` (só loopback); CORS `*` e
     `caminhoSeguro` mantidos (a origem `null` do plugin exige o CORS).
  4. **Guarda de banco** — `fixtures.ts`: `exigirBancoIsolado()` recusa quando o nome do banco
     derivado é igual ao do banco-base; o base é capturado em `config.ts` (`BASE_DATABASE_URL`,
     antes do `bootstrap` redirecionar). Como o processo da colheita já roda com a variável
     redirecionada, `harvest.ts` spawna os fixtures **sem** a `DATABASE_URL` de exportação
     (o filho a resolve do `.env`). `exportDbEnv`/`GUARD_RESET` (código morto) **removidos**.
  5. **Invariantes** — `plugin-check.ts`: #15/#16 passam a valer também sobre a **árvore
     montada** (frames não-instância; os filhos de instância vêm clonados do mestre e são
     cobertos pelo mestre); o pareamento (#18) agora **falha** ("pares sem alvo") quando não
     encontra o alvo, em vez de `j++; continue`. O `j++; continue` era o único ponto de
     "pulo em silêncio"; a #17 (paginação) já falha pelo alvo, não tem pulo silencioso.
  6. **Docs** — `CHANGELOG.md`: "14 → 18 invariantes", fonte Inter registrada como mudança
     visual pretendida (além das marcas aditivas) e entrada do endurecimento; `MAPA.md §3/§6/§9`:
     bloco `15–18`, #15/#16 na árvore, 3ª medição **2,421%**, limitação das **2 telas** com
     `monospace` (`LoginForm.tsx`, "V1.0.0"), pendência obsoleta do `compare` removida;
     comentários das invariantes alinhados à tabela §6 (não há mais dois `13)` nem o `14)`).
- **Invariantes/testes acrescentados:** guarda de **resiliência da importação** (checagem
  extra do `figma:check`, fora da numeração da §6): o `criarFetch` aceita falhas forçadas e a
  checagem exige que uma cena que não carrega (HTTP 500) e uma conferência 1:1 que não envia
  sejam **registradas com a mensagem real**, que a importação **continue** e que nenhum
  `ReferenceError` apareça. Também novas: guarda de manifesto/cenas ausentes, #15/#16 na árvore
  e #18 falhando em alvo de pareamento ausente.
- **Testes e resultado:** `npm run figma:harvest` → **47/47** (exit 0); `npm run figma:check` →
  **verde** (exit 0; fidelidade da montagem e resiliência em 0); `npx tsc --noEmit` limpo;
  `npx eslint` limpo nos arquivos alterados. **Dentes provados** (defeito reintroduzido →
  vermelho → revertido byte a byte, hashes conferidos): `catch` da cena (4 defeitos), `catch`
  do `/verify` (3), `listen` sem host (`0.0.0.0`/`::`), guarda dos fixtures (sem ela alcança
  `limpar()`), manifesto com cena não capturada (`ENOENT` → mensagem clara), filtro da colheita
  (defeito listava 2 cenas, com correção 1) e defeitos na árvore (1041 frames com dois `grow`;
  18 pares sem alvo).
- **Commit SHA:** `67e102438d0088018da3d2bcb75608127cff06c5` (o contrato foi commitado em
  seguida, com o mesmo `KAN-166`).
- **Riscos/pendências:** (a) a guarda de resiliência é uma checagem **extra**, não numerada na
  tabela §6 (a tabela segue com 18 invariantes); (b) nenhum arquivo de `src/**` ou `prisma/**`
  foi tocado; (c) sem push — integração a cargo do Orquestrador.

