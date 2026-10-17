# Exportação do sistema para o Figma

Ferramenta de desenvolvimento que reconstrói as telas do Nexus como **componentes
reutilizáveis com propriedades** no Figma, ao lado de uma captura 1:1 de referência.

Não usa o MCP oficial do Figma (que tem limite baixo de chamadas): o trabalho é
feito por um **plugin local** executado dentro do Figma + um **servidor local**
que entrega as cenas colhidas do próprio sistema.

```
navegador (Playwright)          plugin no Figma
   │  colhe o DOM real            │  monta biblioteca + telas
   ▼                              ▼
out/figma-export/  ──── servidor local ────►  página "Nexus Export"
  scenes/*.json                                página "Nexus · Componentes"
  screens/*.png   (gabarito 1:1)
  verify/*.png    (reexportado pelo Figma → conferência automática)
  figma/*.json    ◄── leitura da página de trabalho do design (volta)
```

## Como rodar

```bash
# 1) colhe as telas do sistema (sobe o Next apontando para o banco de exportação)
npm run figma:harvest

# 2) examina erros de API do plugin sem abrir o Figma
npm run figma:check

# 3) entrega as cenas ao Figma
npm run figma:serve
```

E no Figma:

- **Plugins ▸ Development ▸ Import plugin from manifest…** e escolha
  `tools/figma-export/plugin/manifest.json`.
- Abra o arquivo de destino (`Projeto-final`), rode **Plugins ▸ Development ▸ Nexus Export**.
- Clique em **Carregar telas**, escolha as telas e **Importar**.

> O servidor do passo 3 precisa estar rodando durante a importação.
> Marque **conferir 1:1** para que o plugin reexporte cada tela de volta; depois:

```bash
npm run figma:compare     # % de pixels divergentes por tela + mapa em out/figma-export/diff/
```

### Trazer o design de volta (Figma → app)

Com o servidor rodando, no plugin use a aba **Ler do Figma**: escolha a página onde
o time de design trabalha, **Carregar páginas** → **Ler a página e enviar**. Depois:

```bash
npm run figma:diff              # usa a leitura mais recente
npm run figma:diff page-1       # ou uma leitura específica
```

Sai `out/figma-export/diff-design.md` com o que mudou em três níveis — tokens,
componentes (já com o arquivo do código) e telas — e o que não tem correspondência
no app. Nada aqui depende de plano pago.

## O que é gerado no Figma

| Página | Conteúdo |
| --- | --- |
| `Nexus · Componentes` | coleções de variáveis (`Nexus / Cor`, `Nexus / Métrica`), os componentes mestres e a biblioteca de ícones |
| `Nexus Export` | uma linha por tela: `<id> · EDIT` (vetorial editável) e `<id> · REF` (PNG travado de referência) |

### Button

O `Button` é montado sempre com a mesma forma — o ícone **não** fica embutido no mestre
(a ocorrência usada como referência não "contamina" o componente):

| Propriedade | Tipo | Para quê |
| --- | --- | --- |
| `Rótulo` | TEXT | texto do botão |
| `Mostrar rótulo` | BOOLEAN | desligue para o caso "só ícone" |
| `Mostrar ícone à esquerda` / `… à direita` | BOOLEAN | com ou sem ícone de cada lado |
| `Ícone esquerdo` / `Ícone direito` | INSTANCE_SWAP | troca por qualquer ícone da biblioteca |

A largura **abraça o conteúdo** (o `inline-flex` do código vira hug no Figma), então o
botão encolhe sozinho ao trocar o rótulo, ocultar um ícone ou ficar só com ícone.

Os ícones da aplicação (`public/icons/**`) viram componentes `Ícone · <nome>` na mesma
página, e é entre eles que a troca acontece.

Componentes promovidos (primitivas marcadas com `data-figma` na aplicação):`Button`, `PageButton`, `SearchBar`, `TableHeader`, `TableRow`, `TablePagination`,
`Modal`, `ConfirmDialog`, `Aviso`, `Sidebar`, `SidebarItem`, `SidebarGroup`,
`SidebarSubItem` — com variantes reais (ex.: `Button · primary`, `TableRow · alternada`,
`SidebarItem · ativo`) e propriedades `TEXT` para cada texto (via `addComponentProperty`).

As telas usam **instâncias**; o plugin sobrescreve os textos pela propriedade e troca a
variante dos componentes aninhados (por isso a sidebar mostra o item ativo correto em
cada tela, mesmo sendo um único componente).

Cada mestre leva na **descrição** o caminho do código
(`Origem: src/components/Button.tsx#Button · primary · padrao`): o time de design vê onde
aquilo vive no sistema, e é essa âncora que o `figma:diff` lê para dizer onde mexer.

## Trabalhar no Figma (regras do time de design)

1. **Não edite o que foi exportado.** A importação apaga e reconstrói todo o conteúdo de
   `Nexus · Componentes` e os frames `· EDIT`/`· REF` de `Nexus Export`.
2. **Copie o componente para uma página sua** (a `Page 1`) e edite a cópia — assim a
   alteração sobrevive à próxima importação. Nada fora dessas duas páginas é tocado.
3. **Mantenha o nome do componente.** O casamento da volta é por nome
   (`Button · primary · padrao`): copiar, *detach* e mudar de seção são inofensivos;
   **renomear** não é.
4. **Componente novo** é implementado à mão: ele aparece no relatório como
   "sem correspondência", então avise que é novo em vez de contar com a automação.

## Como a fidelidade é obtida

- A colheita lê o **DOM renderizado** + `getComputedStyle` — não o JSX. Cores, fontes,
  sombras, raios e bordas por lado vêm do que o navegador realmente pintou.
- Contêineres `display:flex` sem margens e sem filhos fora do fluxo viram **auto-layout**
  (padding, gap, alinhamento, `grow`/`stretch`). O resto fica posicionado de forma absoluta.
- Ícones SVG viram **vetores** (`createNodeFromSvg`, com `currentColor` resolvido);
  imagens raster vão embutidas como data URL.
- Cada tela tem também um `· REF` travado com a captura do navegador — é o gabarito 1:1
  que não depende de nenhuma inferência.

## Banco de dados

A colheita **nunca usa o banco de desenvolvimento**. Ela trabalha em um banco próprio
(`nexus_figma_export`, derivado da `DATABASE_URL` trocando apenas o nome), aplicado pelo
`prisma/seed.ts` + fixtures dedicados (`tools/figma-export/fixtures.ts`).

Para apontar para outro banco, crie `tools/figma-export/.env` (ignorado pelo git):

```
FIGMA_EXPORT_DATABASE_URL="mysql://usuario:senha@host:3306/outro_banco"
```

## Escopo dos cenários

`tools/figma-export/scenarios.ts` é a única fonte do escopo. Hoje são 48 telas:
telas públicas (login, primeiro acesso, definir senha), dashboard, e para cada cadastro
(usuários, funcionários, destinatários, fornecedores, veículos, produtos, perfis)
a listagem, a busca sem resultados e os quatro modais (novo, visualizar, editar, excluir).

```bash
npm run figma:harvest -- --only produtos/lista --only acesso/login   # subconjunto
npm run figma:harvest -- --app-url http://localhost:3000            # usa um dev já rodando
```

## Limitações conhecidas

- Com `documentAccess: "dynamic-page"` (que o manifest usa), várias leituras
  **síncronas** do Figma lançam em vez de devolver o valor — por exemplo
  `instance.mainComponent` (use `await instance.getMainComponentAsync()`) e
  `figma.root.children[x]` (use `await pagina.loadAsync()`). Já custou caro uma vez.
- O `manifest.json` **não tem `id`** de propósito: plugins de desenvolvimento importados
  do manifest não têm id registrado, e por isso `getPluginData`/`setPluginData` do Figma
  **não funcionam** (erro "without an ID"). A ferramenta marca o que criou pelo nome
  (`<id> · EDIT` / `<id> · REF`, componentes na página da biblioteca) e varre apenas as
  páginas que são inteiramente dela.
- Gradientes e imagens de fundo em CSS `.bg` não são suportados (o aviso sai no relatório).
- Uma cor de traço por nó: bordas com cores diferentes por lado usam a cor de um dos lados
  (os **pesos** por lado são preservados).
- Fontes que não existem no Figma (`SF Pro`, `Segoe UI`) caem para `Inter`.
- `::before`/`::after` com `content` não são renderizados.
- Telas que existem só no Figma (`/mov-estoque`, `/pedidos`, `/relatorios`) não são geradas:
  a exportação é aditiva e não altera o que já está no arquivo.
- A volta compara **tamanho e conjunto de elementos** das telas, não a posição de cada
  elemento: os frames da camada editável têm nome de tag (`div`, `span`), então não há
  como saber automaticamente a qual elemento do JSX uma moldura movida corresponde.
  Tokens e componentes (que carregam nome e propriedades) são comparados com precisão.
