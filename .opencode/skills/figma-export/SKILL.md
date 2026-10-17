---
name: Figma Export (Nexus)
description: Exportar as telas do sistema Nexus para o Figma sem o MCP oficial — colher as cenas do app, servir para o plugin local, importar, comparar 1:1 e consertar o que divergir — e trazer de volta as alterações de design (tokens, componentes e telas) com `figma:diff`. Use sempre que a tarefa envolver "exportar para o Figma", o plugin Nexus Export, componentes/propriedades no Figma, divergência entre o Figma e o app, ou implementar no sistema uma alteração feita no Figma.
---

# Exportar o Nexus para o Figma

Ferramental em `tools/figma-export/`. **Leia `tools/figma-export/MAPA.md` primeiro** —
ele tem a arquitetura, o contrato de dados, as invariantes e o histórico de bugs.
Este arquivo é o roteiro de execução e as armadilhas.

## Regra zero

**Não use o MCP oficial do Figma.** Ele tem limite baixo de tool calls e, no sandbox
dele, `fetch` não existe — ou seja, ele **não consegue** buscar as cenas daqui. O
caminho é o plugin local.

## Fluxo

```bash
npm run figma:check        # SEMPRE antes de pedir para o usuário importar
npm run figma:harvest      # só se o app ou os cenários mudaram
npm run figma:serve        # deixa rodando; o plugin busca as cenas nele
```

No Figma (o usuário faz): **Plugins ▸ Development ▸ Nexus Export** → *Carregar telas* →
*Importar* com **substituir importação anterior**; com **conferir 1:1** ele reexporta
cada tela. Depois: `npm run figma:compare` (0,5% de pixels divergentes é o limite).

## A volta (design → app)

Quando o time de design mudou algo no Figma, o caminho é o **mesmo plugin**, aba
**Ler do Figma**: escolher a página de trabalho, *Carregar páginas* → *Ler a página e
enviar* (o servidor precisa estar rodando). Isso grava
`out/figma-export/figma/<página>.json`. Depois:

```bash
npm run figma:diff              # leitura mais recente
npm run figma:diff page-1       # leitura específica
```

O relatório (`out/figma-export/diff-design.md`) tem três níveis, e é honesto sobre eles:

| Nível | Dá para automatizar? |
| --- | --- |
| **Tokens** (variáveis × `globals.css`) | sim — nome normalizado (`brand` → `--color-brand`), hex e `rem`→`px` |
| **Componentes** (nome do mestre + âncora na descrição) | sim — o relatório já traz o arquivo do código |
| **Telas** (`· EDIT` × cena colhida) | não — a camada editável tem nome de tag; só tamanho e contagem são comparados |
| **Sem correspondência** | não — componente novo ou renomeado, implementação manual |

Regras para os designers (as duas primeiras são o que faz a volta funcionar):

1. **Manter o nome do componente** — o casamento é por nome, não por vínculo; copiar,
   *detach* e mudar de seção são inofensivos, renomear não é.
2. **Copiar para uma página própria** e editar a cópia: a importação reconstrói
   `Nexus · Componentes` e os frames `· EDIT`/`· REF`, então editar em cima do exportado
   se perde. Nada fora dessas duas páginas é tocado pela ferramenta.
3. Componente novo → avisar (entra no relatório como "sem correspondência").

Ao mexer no `diff.ts`, verifique com um **snapshot sintético** (monte uma leitura a partir
da colheita com edições propositais: raio, preenchimento, tamanho de texto, cor de token,
tela redimensionada, componente inexistente) — o pior defeito possível é o diff dizer
"nenhuma diferença" com o design mudado. Foi assim que os dois bugs do diff apareceram.

## Ordem de trabalho quando algo está errado no Figma

1. **Reproduza sem o Figma.** `npm run figma:check` roda o plugin inteiro em `node:vm`
   com um mock da Plugin API. A maior parte dos bugs aparece aqui.
2. **Se passar, olhe a captura, não o Figma.** `out/figma-export/scenes/<tela>.json` é
   o que foi medido no navegador; compare com o que o Figma mostra. Erros de captura
   se resolvem no `dom-walker.js`; erros de montagem, no `plugin/code.js`.
3. **Faça o mock emular o Figma de verdade** e transforme o bug em invariante
   (`plugin-check.ts`). Se a invariante for vaga, ela gera alarme falso — prefira
   asserções exatas (tamanho, id, largura).
4. **Prove que o teste tem dentes**: reintroduza o bug, rode o check, confirme que
   falha, desfaça. Sempre salvando os **bytes originais** para restaurar (um script
   anterior corrompeu um arquivo de cena por restaurar errado).
5. Valide antes de entregar: `npx tsc --noEmit`, `npm run lint`, `npm test`
   (165 testes), `npm run figma:check`.

## Armadilhas que já custaram caro

- Sandbox do Figma **não tem `URL`, `setTimeout`, `atob` nem DOM** (`fetch` o Figma
  fornece). Foi um `new URL(...)` que gerou o "not defined" no conferir 1:1.
- `documentAccess: "dynamic-page"`: `instance.mainComponent` **lança** → use
  `await instance.getMainComponentAsync()`; página exige `await pagina.loadAsync()`;
  trocar de página, `await figma.setCurrentPageAsync(page)`.
- `layoutMode` **encolhe** o quadro para o conteúdo (e quadro novo nasce `AUTO`):
  fixe as dimensões antes e restaure o tamanho medido depois, salvo quando o `hug`
  for intencional (`data-figma-hug`).
- Componente com filhos posicionados (grid, ou com `margin`) **não reflui ao ser
  redimensionado** → nesse caso a largura precisa entrar na chave do mestre.
- `instance.children` **omite filhos invisíveis**: pareie por categoria, nunca por
  índice às cegas.
- A API de plugin data exige `id` no manifest (plugin de dev não tem) → marcação por
  **nome**.
- `data-figma-variant/state/columns` formam a identidade do mestre; `data-figma-slot`
  e `data-figma-icon` marcam slots; **não remova nem renomeie** esses atributos nos
  componentes de `src/components`.

## Fronteiras

- A exportação é **aditiva**: só mexe nas páginas `Nexus · Componentes` e `Nexus Export`.
- A colheita usa um **banco isolado** (`nexus_figma_export`) e fixtures próprios;
  nunca lê nem escreve no banco de desenvolvimento.
- Compostos (`DataTable`, `Modal`, formulários) existem **só na biblioteca** — o
  conteúdo deles varia por tela e uma instância não reproduz isso.
- Fidelidade primeiro: na dúvida, mantenha o posicionamento medido (absoluto) e deixe
  a camada `· REF` provar o 1:1.
