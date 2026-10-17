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
(texto próprio, input/select/placeholder/truncamento) · `unionRects`/`contentBox` ·
`styleOf`/`borderOf` (bordas por lado) · `aplicarLayout` (auto-layout + `hug` +
`SPACE_BETWEEN` de `margin-left:auto`) · `marcasDe` (lê `data-figma*`) · `visit`/`assign`
(içamento de `position:fixed`) · `prune`/`strip` (colapsa invólucros) · `serialize` ·
`resolveAssets` (SVG inline e imagem como data URL).

**`plugin/code.js`** — `importar` (orquestra) · `construirBiblioteca` (ocorrência **mais
completa**, do menor para o maior) · `garantirMestre`/`garantirIcone` · `montarButton`
(mestre canônico do Button) · `ligarPropriedadesButton` · `construir` (nó a partir da
spec) · `aplicarLayoutBase` (a ordem crítica das dimensões) · `aplicarOverrides`/
`aplicarAninhados`/`aplicarPropriedadesButton` · `chaveDe`/`nomeDoMestre`/`dimensoesDe`/
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
arquivos) · `clonarFilhos` (instâncias) · `main` (roda a importação e as invariantes).

## 4. Contrato de dados (o que o plugin consome)

`scenes.json` (manifesto) → `{ viewport, scale, sceneServer, scenes[], origem }`.
`origem` é a tabela `Componente → arquivo` de `origem.ts`: o plugin a usa para
carimbar a descrição de cada mestre e o `diff.ts` para dizer onde mexer.
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
- **Variáveis**: coleções `Nexus / Cor` e `Nexus / Métrica` derivadas de
  `src/app/globals.css`, ligadas a fills/raios que coincidem.
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

## 9. Estado atual e pendências

**Verificado**: `npm run figma:check` limpo (53/53 componentes com o tamanho de
ocorrência real e âncora de origem, 21/21 promovidos de `COMPONENTES` com a marca
`data-figma` no arquivo de `ORIGEM` — invariante #13 —, 47/47 telas em 1366×768,
0 duplicações, 0 larguras incompatíveis, 0 campos desalinhados, 0 mestres aninhados,
0 formulários sem fundo, 0 soltos, 0 sobreposições, 6 pacotes), `tsc`, `eslint` e os
165 testes da app passando.

**Pendente**: o `npm run figma:compare` **nunca rodou de verdade** — depende de uma
importação com **conferir 1:1** para popular `out/figma-export/verify/`. A rota do
servidor já foi testada com um POST real (ok). Limite aceito: 0,5% de pixels divergentes.

**Pendente (volta)**: a leitura real de uma página do Figma (aba *Ler do Figma*) ainda
não foi exercitada no Figma. O que **está** verificado: o `figma:check` roda a leitura de
`Nexus Export` no mock (94 nós na raiz, 47 quadros `· EDIT`, 1.469 instâncias, 45 com
âncora de código, 19 variáveis) e o `diff` foi conferido com um **snapshot sintético**
gerado da colheita, com edições propositais (raio, preenchimento, tamanho de texto, cor
de token, tela redimensionada, componente inexistente), reportando exatamente elas — foi
assim que os dois bugs do diff acima apareceram. O que falta é o casamento real com a
`Page 1` (cópias editadas pelos designers).

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
