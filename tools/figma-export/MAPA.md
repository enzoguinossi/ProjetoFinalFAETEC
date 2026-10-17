# MAPA — Exportação do Nexus para o Figma

> Documento de continuidade. Existe para que qualquer sessão (mesmo depois de
> compactação de contexto) saiba **o que existe, como funciona, o que já quebrou
> e o que ainda falta** sem precisar redescobrir.
>
> Leia este arquivo antes de mexer em `tools/figma-export/`.
> O passo a passo de uso está no `README.md`; a skill operacional está em
> `.opencode/skills/figma-export/SKILL.md`.

---

## 1. O que é

Ferramental de desenvolvimento que reconstrói as telas do Nexus no Figma como
**componentes reutilizáveis com propriedades**, ao lado de uma captura 1:1 de referência.
**Não usa o MCP oficial** (limite de tool calls): o trabalho é feito por um **plugin
local** executado dentro do Figma + um **servidor local** que entrega as cenas.

```
   navegador (Playwright)              plugin local no Figma
   ├─ lê o DOM renderizado             ├─ monta a biblioteca (seções + mestres)
   ├─ getComputedStyle de cada nó      ├─ monta as telas com instâncias
   └─ screenshot 1:1 do viewport       └─ reexporta cada tela (conferência 1:1)
              │                                      ▲
              ▼                                      │
        out/figma-export/  ──── servidor local ──────┘
          scenes/*.json  ·  screens/*.png  ·  verify/*.png  ·  icons.json
```

## 2. Como rodar

```bash
npm run figma:harvest     # 1) colhe as 47 telas do sistema (banco isolado)
npm run figma:check       # 2) valida o plugin SEM abrir o Figma (mock da Plugin API)
npm run figma:serve       # 3) entrega as cenas ao plugin  (deixar rodando)
```

No Figma: **Plugins ▸ Development ▸ Import plugin from manifest…** →
`tools/figma-export/plugin/manifest.json` → **Nexus Export** → *Carregar telas* →
*Importar* (com **substituir importação anterior**). Marcando **conferir 1:1**:

```bash
npm run figma:compare     # % de pixels divergentes por tela + mapa em out/figma-export/diff/
```

Scripts extras: `figma:fixtures` (só os fixtures do banco de exportação).

### 2.1 A volta (design → app)

Os designers **copiam** os componentes da biblioteca para uma **página própria**
(`Page 1`) e editam a cópia lá: a reexportação reconstrói `Nexus · Componentes` e os
frames `· EDIT`/`· REF`, então editar em cima do que foi exportado se perde na
importação seguinte. No plugin, aba **Ler do Figma** → escolha a página → *Ler a
página e enviar*:

```bash
npm run figma:diff              # usa a leitura mais recente
npm run figma:diff page-1       # usa out/figma-export/figma/page-1.json
```

Sai um relatório em `out/figma-export/diff-design.md`: tokens, componentes (já com o
arquivo do código onde mexer) e telas. Ver §11.

## 3. Arquivos e responsabilidades

| Arquivo | Papel |
| --- | --- |
| `config.ts` | caminhos, portas (app 3210, servidor 5178), viewport **1366×768**, `DEVICE_SCALE 2`, URL do banco de exportação |
| `bootstrap.ts` | aponta `DATABASE_URL` para o banco isolado **antes** de qualquer import da app |
| `scenarios.ts` | **única fonte do escopo**: 47 cenários (rota + passos + subgrupo) |
| `session.ts` | forja o JWT reaproveitando `signToken` da app (respeita o campo `sv`) |
| `fixtures.ts` | dados ricos no banco de exportação (idempotente; apaga só o que ele cria) |
| `origem.ts` | **âncora de código** por componente: vai para a descrição do mestre e para o `diff` |
| `tokens.ts` | **fonte única dos tokens de design**: lê `src/app/globals.css` (`@theme` + `:root`, ignorando os aliases legados) e devolve `cores`/`metricas` para o manifesto |
| `harvest.ts` | orquestra tudo: banco → `next dev` → Playwright → `scenes/` + `screens/` + `icons.json` |
| `dom-walker.js` | **o coração da captura**: DOM + `getComputedStyle` → especificação de nós |
| `server.ts` | serve `out/figma-export` com CORS `*`, recebe `/verify/<tela>` e `/snapshot/<página>` |
| `plugin/code.js` | motor do Figma: biblioteca (seções/mestres/variáveis) + telas + **leitura de volta** |
| `plugin/ui.html` | painel do plugin (abas *Exportar* e *Ler do Figma*) |
| `plugin/manifest.json` | `documentAccess: dynamic-page`, `devAllowedDomains: localhost:5178`, **sem `id`** |
| `plugin-check.ts` | roda o plugin em `node:vm` com **mock da Plugin API** + invariantes |
| `compare.ts` | diff pixel a pixel entre navegador e Figma (sharp) |
| `diff.ts` | diff do design lido de volta contra a colheita e o `globals.css` |

### Funções recorrentes (onde mexer)

**`dom-walker.js`** — `walkDom` (entrada) · `parseColor`/`rgba`/`mesmaCor` (canvas como
resolvedor de qualquer cor CSS) · `parseShadows`/`splitTopLevel` · `ownTextSpec`
(texto próprio, input/select/placeholder/truncamento) · `unionRects`/`contarLinhas`/
`contentBox` (caixas; **linhas visuais**, não caixas de nós de texto) ·
`styleOf`/`borderOf` (bordas por lado) · `aplicarLayout` (auto-layout + `hug` +
`SPACE_BETWEEN` de `margin-left:auto` + as duas regras do `grow`) · `marcasDe` (lê
`data-figma*`) · `visit`/`assign` (içamento de `position:fixed`) · `prune`/`strip`
(colapsa invólucros) · `serialize` · `resolveAssets` (SVG inline e imagem como data URL).

**`plugin/code.js`** — `importar` (orquestra) · `construirBiblioteca` (ocorrência **mais
completa**, do menor para o maior) · `garantirMestre`/`garantirIcone` · `montarButton`
(mestre canônico do Button) · `ligarPropriedadesButton` · `construir` (nó a partir da
spec) · `aplicarLayoutBase` (a ordem crítica das dimensões) · `aplicarOverrides`/
`aplicarAninhados`/`adotarTamanhoDaOcorrencia`/`aplicarPropriedadesButton` · `chaveDe`/`nomeDoMestre`/`dimensoesDe`/
`assinaturaEstrutural`/`larguraComoDimensao` (identidade dos mestres) · `grupoDe`/
`secaoDoGrupo`/`posicionarNaSecao`/`arrumarSecoes` (pacotes) · `garantirVariaveis`/
`vincularVariaveis` · `limparSoltos` · `origemDoServidor` · `registrarFalha` ·
`descricaoDoMestre`/`descricaoDoIcone` (âncora de origem) · **volta**: `lerNo`/
`lerVariaveis`/`lerPagina`/`listarPaginas`.

**`diff.ts`** — `carregarSnapshot` · `lerTokensCss`/`normalizar`/`diffTokens` ·
`nomeDoMestre`/`ocorrenciasDoApp` (espelham o plugin) · `camposDoMestre`/`diffComponentes` ·
`diffTelas` · `main` (relatório em `out/figma-export/diff-design.md`).

**`harvest.ts`** — `main` (orquestra) · `iniciarApp`/`encerrarApp` (taskkill da árvore) ·
`garantirSchema`/`garantirSeed`/`limparCadastros`/`aplicarFixtures` · `capturarCena`
(retry + diagnóstico) · `executarPasso`/`clicar` (clique com retry até a hidratação) ·
`exportarIcones` · `esperarApp`.

**`plugin-check.ts`** — `criarFigmaMock` (a Plugin API inteira) · `criarFetch` (serve os
arquivos, com falhas forçadas para exercitar os `catch` do plugin) · `clonarFilhos`
(instâncias) · `main` (roda a importação e as invariantes — as de **fidelidade da
montagem** ficam no bloco `15–18`, sobre as cenas **e** sobre a árvore construída:
`grow` sem peso, `grow` com sobra, paginação em uma linha, geometria da instância
contra a ocorrência).

**`tokens.ts`** — `lerTokensGlobais` (tokens do `globals.css` → `cores` por hex e
`metricas` em px; ignora os aliases do `:root` e **falha se a tabela vier vazia**) ·
`expandirHex` (`#abc` → `#aabbcc`) · `comoPx` (`rem`/`px`/número → px).

## 4. Contrato de dados (o que o plugin consome)

`scenes.json` (manifesto) → `{ viewport, scale, sceneServer, scenes[], origem, tokens }`.
`origem` é a tabela `Componente → arquivo` de `origem.ts`: o plugin a usa para
carimbar a descrição de cada mestre e o `diff.ts` para dizer onde mexer.
`tokens` é o resultado de `tokens.ts` sobre o `globals.css` —
`{ cores: { <nome>: "#rrggbb" }, metricas: { <nome>: <px> } }` — e o plugin o aplica
como variáveis no Figma (upsert).
Cada `scenes/<tela>.json`:

```jsonc
{
  "id": "usuarios/modal-editar", "title": "...", "group": "Cadastros",
  "route": "/usuarios", "viewport": { "width": 1366, "height": 768 },
  "refImage": "screens/usuarios__modal-editar.png",   // nome do verify vem daqui
  "styles": [ /* tabela de estilos deduplicada, indexada por número */ ],
  "root": { /* nó */ }
}
```

Nó: `kind` (`frame|text|svg|image`) · `name` · `n` (id do elemento no DOM — usado para
detectar duplicação) · `x/y/w/h` **relativos ao pai** · `style` (índice) · `clip` ·
`children`. Texto: `text.value/style/singleLine/truncated/verticalCenter`. SVG:
`svg` (markup inline) · imagem: `imgData` (data URL). Auto-layout: `layout.mode/gap/
padding/primaryAlign/counterAlign/hug` e, por filho, `grow`/`stretch`.

`grow` é o "Fill" do Figma e vale só onde ele REPRODUZ o CSS: com um único filho que
cresce **e** sobra para distribuir (o Figma não tem peso de `flex-grow` — dois filhos
Fill dividem por igual — e, medido, o tamanho da ocorrência já é a verdade). Ver §6
invariantes 15/16 e §8.

**Marcas lidas do DOM** (`data-figma*`, só atributos, sem efeito visual):

| Atributo | Efeito |
| --- | --- |
| `data-figma="Nome"` | vira componente (se estiver na lista de promovidos) |
| `data-figma-variant` / `-state` / `-columns` | dimensões da variante |
| `data-figma-label` | rótulo (usado no nome da camada e nas propriedades) |
| `data-figma-hug="horizontal\|vertical\|ambos"` | eixo que abraça o conteúdo |
| `data-figma-slot="icon-left\|icon-right\|label"` | slot de componente |
| `data-figma-icon="Nome"` | nome do ícone (vira `Ícone · Nome`) |

**Descrição de cada mestre** (a âncora de origem):

```text
Origem: src/components/Sidebar.tsx#SidebarItem · com-cadastros · ativo
Gerado pela exportação do Nexus.
```

**Snapshot da volta** — `out/figma-export/figma/<página>.json`, escrito pela aba
*Ler do Figma*: `{ pagina, lidoEm, variaveis[], raizes[] }`. Nó:
`tipo/nome/x/y/w/h/visivel` · `texto` + `fonte` · `layout{modo,gap,pad[4],principal,cruzado}` ·
`fills/strokes` (hex + `vinculo` com o nome da variável) · `raio[4]` · `texto/componente/
propriedades/ancoraDoComponente/definicao` nas instâncias · `filhos`. `descricao` carrega
a âncora. Variável: `{ colecao, nome, tipo, valor }` (valor do modo padrão).

## 5. Modelo gerado no Figma

- **Página `Nexus · Componentes`** — fundo geral cinza + **6 pacotes (seções)**:
  `Botões`, `Formulários`, `Sidebar`, `Tabelas`, `Navegação e retorno`, `Ícones`.
  Cada mestre vai para a seção do seu grupo (`grupoDe`), em grade. Os padrões
  compostos (`DataTable`, `Modal`, os 7 `Formulario*`) ganham **fundo branco** próprio.
- **Página `Nexus Export`** — uma linha por tela: `<id> · EDIT` (vetorial) e
  `<id> · REF` (PNG travado, 2×).
- **Nome dos mestres**: `<Componente> · <variante> · <estado> · <N colunas> · <N de largura>`
  (as duas últimas só quando fazem parte da identidade — ver §6).
- **Descrição dos mestres**: `Origem: <arquivo>#<Componente> · <valores>` — a âncora
  que diz ao designer onde aquilo vive no código e permite a volta (§11).
- **Button** (mestre canônico, nunca herda o ícone da primeira ocorrência):
  `Rótulo` (TEXT), `Mostrar rótulo` (BOOLEAN), `Mostrar ícone à esquerda/direita`
  (BOOLEAN), `Ícone esquerdo/direito` (INSTANCE_SWAP entre os 19 ícones).
  É `hug` na largura, então encolhe sozinho (caso "só ícone").
- **Variáveis**: coleções `Nexus / Cor` e `Nexus / Métrica` **derivadas dos tokens do
  `src/app/globals.css`** (fonte única: a colheita os leva no manifesto e o plugin não
  guarda cópia). A importação faz **upsert**: atualiza o valor de modo padrão das
  existentes, cria as que faltam e **não remove** as que saíram da lista (só registra).
  Ligadas a fills/raios que coincidem.
- **Escopo**: só primitivas dos `src/components` viram componentes usados nas telas;
  compostos (`DataTable`, `Modal`, formulários) existem **só na biblioteca**
  (`SOMENTE_BIBLIOTECA`), porque o conteúdo deles varia por tela.

## 6. Invariantes (o que não pode voltar a quebrar)

Todas são verificadas por `npm run figma:check` (e falham o comando):

| # | Invariante | Por que existe |
| --- | --- | --- |
| 1 | `instance.mainComponent` **não pode** ser lido (só `await getMainComponentAsync()`) | o mock lança igual ao Figma |
| 2 | Cada elemento do DOM aparece **uma vez** na cena (`n` único) | pegou o modal duplicado |
| 3 | Componente com filhos posicionados (sem auto-layout) tem a **largura na chave** e a instância tem a largura do mestre | pegou a paginação deslocada |
| 4 | Texto de campo de formulário com `textAlignVertical: CENTER` | pegou os textos desalinhados |
| 5 | Mestre só pode viver na página ou dentro de uma seção | impede mestre aninhado |
| 6 | Formulários sempre com fundo próprio | pedido do projeto |
| 7 | Mestres com o tamanho de **alguma ocorrência real** | pegou o encolhimento por `layoutMode` |
| 8 | Biblioteca sem nós soltos e sem sobreposição; os 6 pacotes existem | organização |
| 9 | Sobrescritas de texto chegando às instâncias (strings esperadas) | pegou coletor devolvendo vazio |
| 10 | Todo mestre tem **âncora de origem** na descrição (`Origem: <arquivo>`) | sem ela a volta fica cega: o `diff` não sabe em que arquivo mexer |
| 11 | O `diff` não pode reportar canto reto como diferença (`raio` 0 ↔ ausente) | senão todo componente de canto reto aparecia como mudança |
| 12 | A **volta** funciona: listar páginas, ler uma página, serializar instâncias com âncora e variáveis | era o único caminho que só seria testado dentro do Figma |
| 13 | Todo componente de `COMPONENTES` tem **âncora em `ORIGEM`** e a **marca `data-figma` no arquivo apontado** (atributo JSX ou chave de objeto); marca no app sem âncora vira aviso, não falha | o `data-figma*` não altera nada visual: mexer num elemento e perder a marca tira o componente da biblioteca sem ninguém notar, e sem âncora a volta do `diff` fica cega |
| 14 | As variáveis de `Nexus / Cor` e `Nexus / Métrica` batem com os tokens do manifesto, uma variável **pré-existente com valor antigo converge** para o valor atual (o upsert atualiza as existentes) e o manifesto **sem `tokens` falha** mandando re-rodar a colheita | os tokens estavam copiados dentro do plugin e ficavam desatualizados quando o `globals.css` mudava — e "reaproveitar a coleção existente" sem atualizar era exatamente o defeito |
| 15 | Nenhum frame tem **mais de um filho com `grow`** — na **cena** e na **árvore** montada | o auto-layout do Figma **não tem peso**: dois filhos "Fill" dividem a sobra por igual, enquanto o CSS divide na proporção de `flex-grow`. A linha "CEP + UF" (2:1) saiu com as duas colunas em 210px e o select da UF **por cima do botão da lupa** |
| 16 | Um frame **com sobra no eixo principal não pode ter filho com `grow`** — na **cena** e na **árvore** montada (instâncias de fora: os filhos vêm clonados do mestre) | um filho que cresce absorve a sobra: sobra significa que o navegador **não** o cresceu (acontece quando o item cresceria num pai que o motor não usou de fato — a coluna do formulário esticada pela grade, com 233px sobrando). No Figma o `Fill` distribuiria essa sobra e empurraria os campos seguintes **para fora do modal** |
| 17 | Não existe texto `"N de N"` (informação de paginação) com `singleLine` falso na cena, nem com auto-resize diferente de `WIDTH_AND_HEIGHT` na árvore | o texto do JSX com várias expressões (`{a} de {b}`) vira vários nós e as caixas eram contadas como LINHAS: saía como `HEIGHT` e o Figma re-quebrava — o "0" caía para a linha de baixo |
| 18 | Dentro de uma **instância**, todo frame pareado (sem `grow`/`hug`) tem o tamanho da **ocorrência daquela tela** (altura sempre; largura quando não é contêiner de texto); um alvo de pareamento ausente **falha** (não é pulado) | o mestre vem da ocorrência **mais completa**: a mensagem do `ConfirmDialog` (3 linhas em outra tela) impunha 68px de altura na instância de 1–2 linhas e o auto-layout do pai empurrava a barra de botões para baixo — o vão que a REF não tem |

## 7. Armadilhas da API do Figma (todas já custaram tempo)

1. **O sandbox não tem APIs de navegador.** `fetch` o Figma fornece; **`URL`,
   `setTimeout`, `atob`, DOM não existem**. Foi o `new URL(...)` que produziu o erro
   "not defined" no conferir 1:1 → usar `origemDoServidor()`.
2. **`documentAccess: "dynamic-page"`**: `instance.mainComponent` **lança** (usar
   `getMainComponentAsync`); `figma.root.children[x]` exige `await pagina.loadAsync()`;
   trocar de página exige `await figma.setCurrentPageAsync(page)`.
3. **`layoutMode` faz o quadro abraçar o conteúdo** e um quadro novo nasce com
   `primaryAxisSizingMode: "AUTO"`. Sempre fixar as dimensões **antes** e restaurar o
   tamanho medido **depois** — exceto quando o `hug` é intencional.
4. **Componente com filhos posicionados não reflui ao ser redimensionado** (grid, ou
   `margin` que impede auto-layout). Nesses casos a **largura entra na chave**.
5. **`instance.children` omite filhos invisíveis** no Figma real → nunca parear por
   índice às cegas; parear por categoria (texto/caixa).
6. **A API de plugin data exige `id` no manifest** — plugin de desenvolvimento não tem.
   Marcação é por **nome** (`· EDIT`, `· REF`, componentes, seções).
7. **Seções** (`figma.createSection`) são o "pacote"; o tamanho é calculado pelo cursor
   do próprio plugin (não depende de a seção crescer sozinha).
8. **`figma.notify` funciona no plugin local**, mas não no `use_figma` do MCP.
9. **`layoutGrow` não tem peso.** O Figma divide a sobra **igualmente** entre os filhos
   "Fill" e **ignora a largura que cada um já tinha**: dois filhos Fill numa linha de
   436px (com `gap` 16) viram 210px cada, mesmo que o CSS tivesse dado 280/140. Só é
   fiel com **um** filho que cresce (aí a divisão é a mesma nos dois motores) e quando
   existe sobra de verdade para distribuir — ver §6 invariantes 15/16.
10. **Um filho de instância não reflui como no CSS.** O mestre vem de **uma**
    ocorrência: alturas que o texto decide (a mensagem do `ConfirmDialog`) chegam à
    instância de outra tela e o auto-layout do pai empurra o que vem depois. Quem
    corrige é `adotarTamanhoDaOcorrencia` — §6 invariante 18.
11. **`Range.getClientRects` conta NÓS, não linhas.** `{a} de {b}` no JSX são três nós
    de texto e três caixas na mesma linha; `white-space` é herdado (um ancestral
    `nowrap` proíbe a quebra em qualquer largura) e o Figma re-quebra o texto pelo
    tamanho da caixa que recebeu — §6 invariante 17, §8.

## 8. Histórico de bugs (sintoma → causa → correção)

| Sintoma | Causa | Correção |
| --- | --- | --- |
| Modais não abriam na captura | Next bloqueia recursos de dev quando a origem é `127.0.0.1` e o servidor sobe em `localhost` (quebra a hidratação) | `APP_URL` com `localhost` + clique com retry |
| Colheita travava no fim | `next dev` filho segura o event loop | `taskkill /T` + `process.exit` |
| `SidebarItem` 102px, `Sidebar` 424px | `layoutMode` definido antes de fixar as dimensões | fixar antes, restaurar depois, `hug` só com marca |
| "Novo +" (ícone depois do texto) | o walker empurrava o texto antes dos filhos-elemento | percorrer `childNodes` na ordem do DOM |
| Botão sempre com o "+" | mestre vinha da primeira ocorrência | `montarButton` canônico + propriedades |
| Biblioteca sobrepondo execuções antigas | cursor com posição fixa (y=0/260) | posicionar abaixo do existente → hoje, seções |
| `spec.text.truncated` (`undefined`) | propriedade errada | o mock pegou; hoje `spec.truncated` |
| `getPluginData` "without an ID" | plugin data exige `id` | removido; marcação por nome |
| Tabelas mostrando os mesmos dados | `coletarTextos`/`coletarValores` devolviam vazio na raiz | parâmetro `ehRaiz` |
| Toda borda virando caixa fechada | pesos por lado eram unificados | `weights` por lado |
| Frames soltos + mestres que não nasciam | `instance.mainComponent` lançando sob dynamic-page | `getMainComponentAsync` + falha registrada |
| Modal **duplicado** (um na frente, outro no fluxo) | nó de `position:fixed` era içado **e** devolvido ao pai | `assign` devolve `true` → `return []` |
| Textos de input desalinhados | ramo `singleLine` vencia o `verticalCenter` | `verticalCenter` primeiro |
| Paginação fora de lugar nos modais | mestre de 1070 usado em tabela de 664 (sem auto-layout) | largura como dimensão da variante |
| `TableHeader` com coluna faltando | nº de colunas varia por entidade | dimensão `columns` |
| Sidebar sem os itens de cadastro | mestre vinha de tela de primeiro acesso (sem usuário) | ocorrência **mais completa** + variante `com/sem-cadastros` |
| Célula truncada vazando | nó truncado com a largura **total** do texto | largura da caixa de conteúdo (`abc…`) |
| Placeholder escuro | navegador não expõe o cinza padrão pelo `::placeholder` | fallback preto a 54% |
| `not defined` no conferir 1:1 | `URL` não existe no sandbox | `origemDoServidor()` |
| Compare não pareava nada | plugin enviava `usuarios%2Flista`, as capturas são `usuarios__lista` | nome derivado de `refImage` |
| Diff: todo token "sem equivalente no globals.css" | `lerTokensCss` guardava o nome **sem** `--` e a busca usava **com** `--` | chave normalizada com o prefixo |
| Diff: todo componente de canto reto aparecendo como diferença | a leitura só grava `raio` quando há raio, e `undefined` ≠ `[0,0,0,0]` | normalizar 0 ↔ ausente na comparação |
| Divergência de 1:1 em **todas** as telas (0,46%–3,89%), crescendo com a densidade de texto | a app declarava `--font-sans: "Inter"`, `font-[Roboto,sans-serif]` na sidebar e `--font-display: "SF Pro","Segoe UI"`, mas **não carregava nenhuma fonte**: o navegador pintava Arial/Segoe UI e o plugin normaliza cada família para Inter/Roboto | carregar **Inter** via `next/font/google` e apontar `--font-sans`/`--font-display` para ela; sidebar passa a usar a mesma fonte (ver §9) |
| Variáveis do Figma com os tokens **antigos** depois de o `globals.css` mudar (e `branco`/`raio-lg/xl/pill` sem equivalente no CSS) | os tokens existiam **copiados à mão** em `plugin/code.js` (`TOKENS_COR`/`TOKENS_METRICA`) e a reimportação só *reaproveitava* as coleções, sem atualizar valor nenhum | fonte única: `globals.css` → `tokens.ts` → manifesto → `garantirVariaveis` faz **upsert** (atualiza existentes, cria novas, mantém as que saíram); invariante #14 prova a convergência |
| CEP do destinatário/fornecedor **sem o botão da lupa** no Figma, com o select da UF 70px à esquerda | `flex-grow: 2` / `flex-grow: 1` viravam `layoutGrow = 1` nos dois filhos: o Figma não tem peso e dividiu a linha em **duas colunas iguais (210px cada)**, então a coluna do CEP encolheu com o conteúdo transbordando e o select da UF (opaco, desenhado depois) cobriu a lupa | `grow` só com **um** filho que cresce e sobra para distribuir; o tamanho medido manda (invariante #15) |
| Paginação em duas linhas no Figma ("Página 1 de" / "0") | `{pageIndex + 1} de {pageCount}` são **três nós de texto** e `Range.getClientRects` devolvia três caixas na **mesma** linha; contadas como "linhas", o texto saía `singleLine: false` → `HEIGHT` no Figma, que re-quebra pela largura da caixa | contar **linhas visuais** (caixas agrupadas por faixa vertical) e tratar `nowrap` herdado como proibição de quebra (invariante #17) |
| `ConfirmDialog` ("Excluir …") com um vão entre a mensagem e a barra de botões (23px a mais que a REF) | o mestre vem da ocorrência **mais completa**, onde a mensagem tem **3 linhas**: o parágrafo do mestre tem 68px de altura e a instância de 1–2 linhas herdava essa altura — o auto-layout do pai empurrava os botões | a instância adota o tamanho da **sua** ocorrência nos filhos pareados (`adotarTamanhoDaOcorrencia`, invariante #18) |
| Modal de destinatário com os campos "empurrados" e **sumindo** no Figma (a partir de "Número/Complemento") | a coluna do formulário é um item de **grade** esticado (921px) e o campo `flex-1` (Logradouro) ficou com `grow` mesmo sem o navegador tê-lo crescido: no Figma o `Fill` absorveu os **233px** de sobra e o resto saiu do recorte do modal | `grow` não vale onde há sobra no eixo principal — o tamanho medido manda (invariante #16) |

## 9. Estado atual e pendências

**Verificado**: `npm run figma:check` limpo (53/53 componentes com o tamanho de
ocorrência real e âncora de origem, 21/21 promovidos de `COMPONENTES` com a marca
`data-figma` no arquivo de `ORIGEM` — invariante #13 —, 47/47 telas em 1366×768,
0 duplicações, 0 larguras incompatíveis, 0 campos desalinhados, 0 mestres aninhados,
0 formulários sem fundo, 0 soltos, 0 sobreposições, 6 pacotes), `tsc`, `eslint`, os
165 testes da app e `next build` passando.

**Verificado (fidelidade da montagem, 4 defeitos reais — KAN-166)**: o usuário revisou o
Figma contra a REF e achou quatro defeitos de **montagem** (a cena estava certa): a lupa
do CEP coberta, a paginação em duas linhas, o vão do `ConfirmDialog` e a deriva vertical do
modal de destinatário. Causa raiz e correção em §8; invariantes 15–18 novas. O
`figma:check` conta as cinco regras (`figma:check` mostra a seção "fidelidade da
montagem"), todas em 0 — **com dentes provados**: reintroduzir cada defeito deixa o
`figma:check` vermelho (23 frames com dois `grow`; 3 colunas com filho `grow` e sobra de
174–233px; 67 textos de paginação quebrados + 1 nó `HEIGHT` re-quebrável; 6 instâncias de
`ConfirmDialog` com a mensagem de 68px contra 22,5/45px da cena) e reverter devolve o
verde. Nenhum arquivo de `src/**` mudou por causa deles: os quatro eram erros de
reconstrução.

**Verificado (tokens, fonte única)**: a colheita leva `tokens` no manifesto
(14 cores + 5 métricas do `globals.css`) e o `figma:check` prova a invariante #14 —
as variáveis de `Nexus / Cor`/`Nexus / Métrica` batem com o manifesto e a importação
**converge** uma variável semeada com valor antigo (`brand` `#ff0000` → `#1b9956`,
`raio-lg` 4 → 8), mantendo (só registrando) as variáveis fora da lista. A invariante
tem dentes: reintroduzir o ramo antigo ("reaproveita sem atualizar") deixa o
`figma:check` vermelho, e um manifesto sem `tokens` falha mandando re-rodar
`npm run figma:harvest`. Os tokens que só existiam na cópia do plugin entraram no
`@theme` (`--color-branco`, `--raio-lg/xl/pill`); nenhum valor existente mudou.

**Verificado (compare, 3 execuções reais)**: `npm run figma:compare` rodou com
importações reais (conferir 1:1). 1ª: **média 2,707%**, 1/47 dentro de 0,5%. Depois de
carregar Inter e padronizar as fontes: **média 2,502%** (1/47) — melhora real, mas
pequena. Depois das correções de montagem (`grow`/paginação/geometria): **média
2,421%** (1/47) — a série é estável e confirma que o resíduo é rasterização, não
reconstrução.

**Diagnóstico do resíduo (não é leiaute nem cor)**: no recorte 1:1 as telas são
visualmente idênticas; a luma global é igual (ex.: 233,41 vs 233,50) e os pixels
divergentes se dividem ~50/50 entre "referência mais escura" e "mais clara" — assinatura
de **rasterização de borda** (Chromium/DirectWrite vs renderizador do Figma), não de peso,
cor ou deslocamento. Testes que confirmam: (a) deslocar a verify em ±1–2 px **não** melhora;
(b) reduzir para 1× (CSS) **piora** (3,387%); (c) blur σ=1 não separa o ruído (2,4–3,7%)
de um deslocamento real de 2 px (3,17%). Conclusão: o limite de **0,5% não é atingível**
com comparação pixel a pixel entre dois renderizadores; o mapa de diff continua sendo o
sinal útil (é o esqueleto de glifos/ícones/bordas).

**Limitações aceitas (2026-10-17)** — decididas com o usuário, para o 1º release:

- **Limite do `compare`:** o resíduo de ~2,4% é rasterização entre renderizadores e **não**
  é atingível o limite de 0,5%. Tentativas descartadas: blur σ=1, SSIM e média por blocos
  (1/4, 1/8, 1/16) — nenhuma separa ruído de defeito pequeno; só troca de cor se destaca.
  O valor numérico continua sendo um **portão de sanidade**; a **evidência de fidelidade é
  o mapa de diff (`out/figma-export/diff/<tela>.png`) olhado por uma pessoa** — foi assim
  que os quatro defeitos de reconstrução foram encontrados.
- **Padding do `ConfirmDialog`:** mesmo após a correção da ocorrência-base (§8), sobra um
  resíduo pequeno no espaçamento. Aceito: os designers ajustam manualmente se alterarem
  essas telas.
- **Fontes `monospace`:** as 2 telas de `acesso/login` (`acesso/login` e
  `acesso/login-erro`) usam `font-family: monospace` no rodapé `V1.0.0`
  (`src/components/LoginForm.tsx`); o plugin normaliza toda família para Inter/Roboto, então
  essa diferença de glifo **permanece** no resíduo do `compare`. Aceito: é texto decorativo
  e o mapa de diff mostra que não passa de glifo.

**Corrigido (4 defeitos de reconstrução, achados na revisão visual da REF)**: `grow` sem
peso dividindo a linha CEP/UF em colunas iguais · paginação `"N de N"` re-quebrando linha ·
`ConfirmDialog` com o tamanho da ocorrência mais completa · `flex-grow` de campo em coluna
de grade esticada virando "Fill". Invariantes **15–18** em `plugin-check.ts` (ver §6).

**Verificado (volta, 1ª leitura real)**: a aba *Ler do Figma* leu a `Page 1` de verdade
(28 variáveis, 32 mestres). Componentes e telas: **nenhuma diferença**. O que aparece
como "sem correspondência" são os mestres próprios da `Page 1` (o arquivo de trabalho dos
designers), não cópias com os nomes do app. Tokens "sem equivalente" = 9 variáveis da
coleção do próprio design + `branco` + `raio-lg/xl/pill` (que **não existiam** no
`globals.css` e agora existem — ver a nota de tokens acima); as 19 variáveis
`Nexus / Cor` e `Nexus / Métrica` **casam** e por isso não
aparecem como diferença. Ver a proposta de de-para em `.ai-workflow/runs/`.

**Verificado (endurecimento pós-revisão — RUN-20261017-02e, KAN-166)**: seis correções de
robustez, com dentes provados (defeito reintroduzido → `figma:check` vermelho → revertido):

- o plugin **não morre mais num `catch` sem binding**: `catch {` + `textoDoErro(erro)` dava
  `ReferenceError` ("erro is not defined") dentro do próprio `catch`, derrubava a importação
  e escondia a causa. Agora uma cena que não carrega e uma conferência 1:1 que não envia são
  **registradas com a mensagem real** e a importação **continua** (falhas forçadas no mock);
- o **manifesto lista só as cenas capturadas** e o `figma:check` **falha com mensagem clara**
  ("rode `npm run figma:harvest`") em vez de estourar `ENOENT`;
- o servidor local escuta em **`127.0.0.1`** (não mais em todas as interfaces);
- os **fixtures recusam** rodar se o banco derivado for o **mesmo** da aplicação;
- as invariantes **#15/#16 também valem sobre a árvore** montada (não só sobre a cena — a
  cena prova o que o walker marcou, a árvore o que o plugin montou) e um **alvo de
  pareamento ausente falha** em vez de ser pulado em silêncio (#18);
- numeração das invariantes no `plugin-check.ts` alinhada à tabela §6 e esta nota.

**Pendente (volta)**: a `Page 1` deve seguir a regra das cópias (copiar os componentes
exportados para uma página própria e editar lá, **mantendo o nome**) para o casamento
render; e o de-para de tokens (PT → token do app) precisa ser confirmado pelo usuário.

**Observações**: o MCP oficial do Figma está bloqueado (limite do plano Starter) — a
verificação vive de `figma:check` + `figma:compare`, que não dependem dele.

## 10. Onde mexer

| Quero | Onde |
| --- | --- |
| Exportar menos/mais telas | `scenarios.ts` (`--only <id>` na colheita) |
| Mudar o tamanho do frame | `config.ts` → `VIEWPORT` |
| Agrupar componentes de outro jeito | `code.js` → `GRUPOS` / `grupoDe` |
| Promover outra primitiva a componente | `code.js` → `COMPONENTES` (e marcar no React) |
| Padrão só na biblioteca | `code.js` → `SOMENTE_BIBLIOTECA` |
| Rigor da comparação | `compare.ts` → `LIMITE_OK` / `LIMITE_CANAL` |
| Novas invariantes | `plugin-check.ts` (e idealmente provar com um teste do teste) |
| Origem (caminho do código) de um componente | `origem.ts` (e a marca `data-figma` no React) |
| Tokens de design (cor/medida) | `src/app/globals.css` — **fonte única**: a colheita lê daí (`tokens.ts`) e o plugin aplica (upsert); não existe mais cópia em `plugin/code.js` |
| O que o diff compara | `diff.ts` → `diffTokens` / `camposDoMestre` / `diffTelas` |
| Qual página a volta lê | escolhida na aba *Ler do Figma*; o `diff` aceita o nome como argumento |

## 11. A volta: ler o design do Figma

### Regras para os designers

1. **Não editar o que foi exportado.** A reexportação apaga e reconstrói todo o
   conteúdo de `Nexus · Componentes` e os frames `· EDIT`/`· REF` de `Nexus Export`.
2. **Copiar para uma página própria** (`Page 1`) e editar a cópia lá — assim a
   alteração sobrevive a qualquer reexportação. Nada fora dessas duas páginas é tocado
   pela ferramenta.
3. **Manter o nome do componente.** É a única regra que não pode quebrar: o
   casamento é por **nome** (`Button · primary · padrao`), não por vínculo. Copiar,
   *detach* ou mover de seção não atrapalha; **renomear** atrapalha.
4. Componente **novo** (nome que não existe no app) entra no relatório como "sem
   correspondência" — é implementação manual, avise.

### O que a volta enxerga

| Nível | Como casa | Dá para automatizar? |
| --- | --- | --- |
| **Tokens** (variáveis × `globals.css`) | nome normalizado (`brand` → `--color-brand`), hex e `rem`→`px` | sim, direto |
| **Componentes** (mestres × ocorrências) | nome do mestre + âncora de código na descrição | sim, direto no arquivo apontado |
| **Telas** (`· EDIT` × cena colhida) | `id` da tela | **não**: os frames da camada editável têm nome de tag (`div`, `span`), então só dá para comparar tamanho e conjunto de elementos — a leitura é humana |
| **Sem correspondência** | nome sem par | não: componente novo ou renomeado |

A leitura é **por página**: a biblioteca espelha o código e a `Page 1` é a intenção do
design, então comparar a `Page 1` com a colheita dá exatamente o delta que interessa.

**Ferramentas pagas: nenhuma.** Code Connect exige plano Org/Enterprise e a REST de
variáveis exige Enterprise; a Plugin API local (que é o que a leitura usa) não tem
restrição de plano. O MCP oficial está fora (limite do Starter).
