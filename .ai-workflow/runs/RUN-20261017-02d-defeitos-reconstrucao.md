# Contrato de Tarefa — RUN-20261017-02d (defeitos de reconstrução)

Parte de `RUN-20261017-02` (KAN-166). Delegado pelo Orquestrador ao agente `developer`.

## Identificação

- **Run ID:** `RUN-20261017-02d`
- **Agente executor:** `developer`
- **Profundidade de delegação:** `1/2`
- **Branch/worktree:** `figma-export` · `C:/Users/Enzo/.local/share/opencode/worktree/853499850a6d48c07df1738ae584e360336ce596/figma-export`
- **Commit-base:** `b37088f`

## Contexto

O usuário revisou as telas do Figma contra a REF (gabarito) e encontrou defeitos **reais**
de reconstrução. As cenas (DOM) estão corretas — o defeito está na montagem do Figma.

**Evidência visual** (topo = navegador/REF, base = Figma) — **abra estas imagens**:

- `C:/Users/Enzo/AppData/Local/Temp/opencode/par-destinatarios__modal-novo.png`
- `C:/Users/Enzo/AppData/Local/Temp/opencode/par-funcionarios__modal-excluir.png`
- `C:/Users/Enzo/AppData/Local/Temp/opencode/par-destinatarios__modal-excluir.png`

## Defeitos a corrigir

1. **CEP sem placeholder e sem a lupa** (destinatários, `modal-novo`/`editar`/`visualizar`).
   Na cena existem os textos `CEP`, `00000-000` e o botão da lupa; no Figma o campo aparece
   **sem o placeholder** e **sem o botão de busca**. Achar por que o nó/botão não é montado
   (sugestão: `prune`/`strip` ou pareamento de filhos em `plugin/code.js`).
2. **Paginação quebra linha** ("Página 1 de 0" → o `0` cai para a linha de baixo).
   `src/components/TablePagination.tsx`: o `<span class="mx-2 whitespace-nowrap">` contém
   `"Página "` + `<strong>1 de 0</strong>`. Na cena, `Página` vem `singleLine:true` e
   `1 de 0` vem `singleLine:false` — o `nowrap` é do **ancestral** e não foi herdado.
   Corrigir a detecção em `dom-walker.js` (`ownTextSpec`) para considerar o
   `white-space` herdado (o texto não pode quebrar quando um ancestral é `nowrap`).
3. **ConfirmDialog com sobra vertical** (`modal-excluir` de funcionários e destinatários).
   Há um vão grande entre a mensagem e a linha de botões (e o diálogo fica mais alto que a
   REF). `src/components/ConfirmDialog.tsx` usa `ui.form` + `ui.rowActions` dentro do
   `Modal`. Achar a origem do espaço extra (gap/padding de auto-layout, altura do mestre
   medida de uma ocorrência maior, etc.).
4. **Deriva vertical no modal de destinatário.** No `modal-novo`, o conteúdo vai sendo
   empurrado para baixo (a seção “Telefones” fica muito mais abaixo que na REF) — os campos
   parecem ocupar mais altura no Figma. Investigar espaçamento/altura por campo.

## Método obrigatório (disciplina do MAPA §7/§8)

1. Reproduza **sem o Figma** (`npm run figma:check` roda o plugin no mock).
2. Cada defeito corrigido vira uma **invariante nova** em `plugin-check.ts`, com asserção
   **exata** (evite asserção vaga, que gera alarme falso).
3. Prove que a invariante tem dentes: reintroduza o defeito, rode o check, veja falhar,
   desfaça. Salve os **bytes originais** ao editar (`src/**` deve voltar idêntico).
4. Rode `npm run figma:harvest` (banco isolado) e confirme `npm run figma:check` verde.
5. `npx tsc --noEmit` e `npx eslint` nos arquivos alterados.

## Escopo

- **Pode alterar:** `tools/figma-export/dom-walker.js`, `tools/figma-export/plugin/code.js`,
  `tools/figma-export/plugin-check.ts`, `tools/figma-export/MAPA.md`, `CHANGELOG.md`.
  Só toque em `src/**` se o defeito for comprovadamente do app (ex.: o `nowrap` ausente) —
  e, nesse caso, **justifique** no relatório.
- **Não tocar:** `prisma/**`, `compare.ts`, `harvest.ts` (salvo se indispensável).

## Critérios de aceite

- `npm run figma:check` verde, com invariante **por defeito corrigido**.
- Evidência de que cada invariante falha quando o defeito volta.
- `npm run figma:harvest` conclui e as cenas refletem a correção.
- `tsc`/`eslint` limpos; `src/**` sem alteração (a menos que justificado).
- Commit com a chave **KAN-166**; preencher o Resultado. Sem push.

## Bloqueio / escalonamento

Se um defeito depender de decisão de design (e não de um erro claro de reconstrução),
**pare e reporte** em vez de “consertar” por conta própria.

## Resultado (preenchido pelo executor)

- **Status:** concluído (4/4 defeitos corrigidos, invariantes com dentes provados).
- **Defeitos corrigidos e causa raiz de cada um:**

  | # | Sintoma | Causa raiz (comprovada) | Correção |
  | --- | --- | --- | --- |
  | 1 | CEP **sem a lupa**, coluna da UF 70px à esquerda (`destinatarios/modal-novo`) | `flex-grow: 2` e `flex-grow: 1` das colunas CEP/UF viravam `layoutGrow = 1` nos **dois** filhos. O auto-layout do Figma **não tem peso**: dividiu a linha de 436px (gap 16) em **duas colunas iguais de 210px** (o CSS deu 280/140). Com a coluna do CEP em 210, a linha interna (280) transbordou e o select da UF — opaco e desenhado depois — passou a cobrir o botão da lupa (240–280). Nas duas metades da evidência o select mede 140px nos dois lados, mas em `dom 227` no Figma contra `296` na REF: 2:1 → 1:1. | `dom-walker.js` `aplicarLayout`: `grow` só com **um** filho que cresce **e** sobra no eixo principal; o tamanho medido (280/140) manda. |
  | 2 | Paginação "Página 1 de" / "0" em duas linhas | `{pageIndex + 1} de {pageCount}` são **três nós de texto**; `Range.getClientRects` devolve **três caixas na mesma linha** e o walker contava *caixas* como *linhas* → `singleLine: false` (36,5×16 medido) → o plugin usava `textAutoResize = HEIGHT` e o Figma re-quebrava pela largura (36,5 é ~1px mais estreito que o desenho dele). Não era o `nowrap` do ancestral: o `white-space` computado já vinha `nowrap` (herdado) e **não** era consultado nesse ramo. | `dom-walker.js`: `contarLinhas` (caixas agrupadas por faixa vertical = linhas visuais) e `nowrap` herdado forçando uma linha. |
  | 3 | `ConfirmDialog` (excluir de funcionários/destinatários) com vão entre a mensagem e os botões | O mestre é construído da ocorrência **mais completa**: a mensagem de outra tela tem 3 linhas, então o `<p>` do mestre tem **68px**; a instância de 1–2 linhas herdava essa altura e o auto-layout do pai empurrava a barra de botões (medido na evidência: ~22,6px reais a mais; o `figma:check` diz `356×68` na instância contra `356×45`/`356×22,5` na cena). | `plugin/code.js` `aplicarAninhados` → `adotarTamanhoDaOcorrencia`: filho pareado de instância adota o tamanho da **sua** ocorrência (fora os que o auto-layout dimensiona: `grow`/`hug`). |
  | 4 | Deriva vertical no modal de destinatário (campos abaixo de "Logradouro" empurrados e sumindo) | A coluna do formulário é item de **grade** esticado (921px) e o campo `flex-1` (Logradouro) tem `flex-grow: 1`, mas o navegador **não o cresceu** (medido: 72px com 233px de sobra na coluna). O walker emitia o `grow` assim mesmo e no Figma o "Fill" absorveu os 233px: cada linha seguinte desceu e saiu do recorte (`overflow` do modal). Medido na captura: pitch das linhas = 88px na REF e na cena (sem crescimento). | `dom-walker.js` `aplicarLayout`: sem sobra não há crescimento a modelar — com sobra no eixo principal, o tamanho medido manda. |

- **Invariantes acrescentadas** (`tools/figma-export/plugin-check.ts`, bloco `14)`, seção
  "fidelidade da montagem (KAN-166)", todas contadas no `falhou`):
  - **15** — nenhum frame tem **mais de um filho com `grow`** (o Figma divide a sobra por igual: 2:1 vira 1:1). *(defeito 1)*
  - **16** — frame **com sobra no eixo principal não pode ter filho com `grow`** (sobra = o navegador não cresceu ninguém ali). *(defeito 4)*
  - **17** — texto `"N de N"` da paginação com `singleLine` falso na **cena** e/ou auto-resize ≠ `WIDTH_AND_HEIGHT` na **árvore**. *(defeito 2)*
  - **18** — dentro de **instância**, todo frame pareado (sem `grow`/`hug`) tem o tamanho da **ocorrência daquela tela** (altura sempre; largura quando não é contêiner de texto). *(defeito 3)*
  - Verificação dupla: as regras 15/16/17 rodam sobre as **cenas** (JSON colhido) e a 17/18 também sobre a **árvore construída** no mock.
- **Dentes (defeito reintroduzido → `figma:check` vermelho → desfeito):**

  | Defeito | Reintroduzido como | Resultado do check |
  | --- | --- | --- |
  | 1 | `filho.grow = sobra <= 2.5 && !!filho.flexGrow` (sem a regra do peso) | `frames com mais de um filho que cresce: 8` + 8 exemplos `(a)`; `exit=1` (`out/figma-export/logs/check-dentes-a2.log`) |
  | 4 | `filho.grow = quantosCrescem === 1 && !!filho.flexGrow` (sem a regra da sobra) | `filho que cresce com sobra no eixo principal: 2` — 233px (novo) e 189px (editar); `exit=1` (`check-dentes-b.log`) |
  | 2 | `lines: rects.length` + heurística de `nowrap` desligada | `textos de paginação em duas linhas (cena): 11` e `que o Figma pode re-quebrar: 20`; `exit=1` (`check-dentes-c.log`) |
  | 3 | remover a chamada de `adotarTamanhoDaOcorrencia` | `filhos de instância com o tamanho de outra ocorrência: 6` (os 6 `*/modal-excluir`: `356×68` contra `356×45`/`356×22,5`); `exit=1` (`check-dentes-d2.log`) |

  Os dois arquivos alterados foram salvos em bytes antes das provas e restaurados por
  cópia, conferidos por `Get-FileHash` (`dom-walker.js` `109D5A96…`, `code.js`
  `7B711F62…`); nenhum marcador temporário sobrou.
- **Testes e resultado:**
  - `npm run figma:harvest` → **47/47 cenários** capturados (banco isolado) — final
    (`out/figma-export/logs/harvest-final.log`).
  - `npm run figma:check` → **verde, exit 0**, com os cinco contadores novos em 0
    (e `53/53` mestres com o tamanho de ocorrência, `47/47` telas em 1366×768,
    `0` duplicações/sobreposições) — (`check-final-3.log`).
  - `npx tsc --noEmit` → **0**; `npx eslint tools/figma-export/{dom-walker.js,plugin/code.js,plugin-check.ts}` → **0**.
  - `src/**` **sem alteração** (`git status` só com os arquivos do escopo): os quatro
    defeitos eram de reconstrução, nenhum do app.
- **Commit SHA:** `2f8d99d` (código + MAPA + CHANGELOG; sem push).
- **Riscos/pendências:**
  - A regra 15 (um único filho com `grow`) tira o "Fill" de linhas com **dois** filhos que
    crescem. Hoje isso só atinge as linhas dos formulários de destinatário/fornecedor
    (`SOMENTE_BIBLIOTECA`, reconstruídos por tela, então sem perda de fidelidade); num
    master futuro usado em larguras diferentes, esses filhos deixam de acompanhar a
    largura do pai.
  - A invariante 18 compara **tamanho** de filho de instância, não posição: um mestre que
    se afaste da ocorrência só em `x/y` (dentro de pai sem auto-layout) continua passando.
  - A regra 16 usa tolerância de 2,5px para a sobra (sub-pixel do DOM); medidas grandes
    (os 174–233px deste run) ficam bem longe do limite.
  - Não foi possível verificar na evidência o "sem placeholder" do CEP: o campo está
    recortado fora nas imagens. O mecanismo medido (coluna do CEP em 210px com a linha
    interna de 280 transbordando) explica a lupa coberta e o campo comprimido, e a
    correção restaura a geometria medida do DOM para os dois.
  - `figma:compare` / `next build` / a suíte da app não foram rodados: nada em `src/**`,
    `prisma/**` ou na configuração de build mudou (o contrato pede harvest + check + tsc +
    eslint).
