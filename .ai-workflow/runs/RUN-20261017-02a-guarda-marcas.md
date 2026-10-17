# Contrato de Tarefa — RUN-20261017-02a (guarda de reuso das marcas)

Parte de `RUN-20261017-02` (KAN-166). Delegado pelo Orquestrador ao agente `developer`.

## Identificação

- **Run ID:** `RUN-20261017-02a`
- **Agente executor:** `developer`
- **Profundidade de delegação:** `1/2`
- **Branch/worktree:** `figma-export` · `C:/Users/Enzo/.local/share/opencode/worktree/853499850a6d48c07df1738ae584e360336ce596/figma-export`
- **Commit-base:** `614205a`

## Objetivo

Garantir, por teste automatizado, que **alterar elementos visuais no código sem manter as
marcas `data-figma*` quebra o `npm run figma:check`** — travando a perda de reuso.

## Fontes de contexto autorizadas

`tools/figma-export/MAPA.md` (§4 contrato de dados, §6 invariantes, §8 histórico, §9 estado),
`tools/figma-export/plugin-check.ts`, `tools/figma-export/origem.ts`,
`tools/figma-export/plugin/code.js` (constantes `COMPONENTES`, `SOMENTE_BIBLIOTECA`),
`AGENTS.md` §Exportação para o Figma.

## Escopo de arquivos

- **Pode alterar:** `tools/figma-export/plugin-check.ts`, `tools/figma-export/MAPA.md`.
- **Não tocar:** `src/**`, `prisma/**`, os demais invariantes existentes, `out/**`.

## Requisitos

1. **Nova invariante (#13)** ao final do `plugin-check.ts`, numa seção impressa
   `── marcas (reuso) ──`, que para **cada** nome em `COMPONENTES` verifica:
   - existe entrada em `ORIGEM` (a âncora de código);
   - o arquivo apontado por `ORIGEM` contém a marca daquele componente, aceitando as
     formas usadas no código: atributo JSX `data-figma="Nome"`, `data-figma={'Nome'}` /
     `data-figma={"Nome"}`, **ou** chave de objeto `"data-figma": "Nome"` (é o caso do
     `Button`, que monta as marcas num objeto `marcas`).
   - Falha acumula em `problema(...)` (ou lista equivalente) de forma que o comando
     **saia com código não-zero**, como as demais invariantes.
2. **Aviso (não-falha)** para uma marca `data-figma="X"` encontrada em `src/` cujo `X` não
   tenha âncora em `ORIGEM` — reporte em `avisos`. **Não** transforme em `problema`
   (componentes como `AppShell`/`AppBar` estão em `ORIGEM` mas fora de `COMPONENTES`).
   Ignore os atributos derivados (`data-figma-*`).
3. Imprima contagem: componentes promovidos, com âncora, com marca, e o resultado.
4. Atualize `tools/figma-export/MAPA.md`: acrescente a invariante **#13** à tabela do §6
   (com o "por quê") e cite-a no §9 (estado atual).
5. **Prove que a invariante tem dentes** (o MAPA exige): renomeie temporariamente a marca
   de um componente (ex.: `Button.tsx`), rode `npm run figma:check`, confirme que **falha**,
   e **restaure os bytes originais** (salve-os antes; um script anterior corrompeu um
   arquivo por restaurar errado). O repositório deve terminar **sem alteração** em `src/**`.

## Critérios de aceite

- `npm run figma:check` **verde** ao final (com a nova seção presente na saída).
- Demonstração registrada de que o check **falha** com uma marca removida.
- `npx tsc --noEmit` sem erros e `npx eslint tools/figma-export/plugin-check.ts` limpo.
- `MAPA.md` atualizado (invariante #13).

## Testes esperados

```bash
npm run figma:check
npx tsc --noEmit
npx eslint tools/figma-export/plugin-check.ts
```

## Restrições

- Não alterar a lógica de produto nem os invariantes existentes.
- Não inventar nomes de componentes: a lista autoritativa é `COMPONENTES` em `code.js`.
- Sem segredos em código/doc. Commits com a chave **KAN-166**.

## Bloqueio / escalonamento

Se alguma marca dos 21 promovidos for **dinâmica** (não literal) e não casar com nenhuma
forma aceita, **não force** a regex: reporte o caso concreto (arquivo:linha) e pare.

## Resultado (preenchido pelo executor)

- **Status:** concluído.
- **Arquivos alterados:** `tools/figma-export/plugin-check.ts` (invariante #13 +
  helpers `marcasDoArquivo`/`arquivosFonte`/`caminhoRelativo`), `tools/figma-export/MAPA.md`
  (§6 tabela + §9 estado atual), `.ai-workflow/runs/RUN-20261017-02a-guarda-marcas.md`
  (este resultado). Nada em `src/**` (verificado com `git status --short -- src/` vazio) nem
  nos invariantes existentes.
- **Testes e resultado:**
  - `npm run figma:check` → **verde (exit 0)**, com a seção nova:
    `── marcas (reuso) ── · componentes promovidos: 21 · com âncora em ORIGEM: 21 · com marca no código: 21`.
  - **Prova de que a invariante tem dentes:** com os bytes originais de
    `src/components/Button.tsx` salvos (sha256 `90c3354a…ced4`, 2.231 bytes), a marca foi
    trocada para `"data-figma": "ButtonRenomeado"`; `npm run figma:check` **falhou
    (exit 1)** com `✗ Button (src/components/Button.tsx)`, `20/21 promovidos com a marca`
    e o aviso `⚠ marca (reuso): "ButtonRenomeado" … mas não tem âncora em ORIGEM` (o
    caminho de aviso também ficou demonstrado). O arquivo foi restaurado por cópia dos
    bytes salvos: sha256 `90c3354a…ced4` idêntico, 2.231 bytes, `git status -- src/` vazio.
  - Formas aceitas conferidas isoladamente: `data-figma="X"`, `data-figma={'X'}`,
    `data-figma={"X"}` e `"data-figma": "X"` casam; `data-figma-*` derivados são ignorados.
  - `npx tsc --noEmit` → **sem erros (exit 0)**.
  - `npx eslint tools/figma-export/plugin-check.ts` → **limpo (exit 0)**.
- **Commit SHA:** `120a4a141ecb5eb6fb611d943d2b4e349468ba53` (implementação;
  `KAN-166: test: invariante de reuso das marcas data-figma no figma:check`). O commit do
  próprio run tem SHA próprio e é posterior a este.
- **Riscos/pendências:**
  - O comentário da checagem do painel em `plugin-check.ts` já estava numerado `// 13)`
    antes desta tarefa (o §6 do MAPA não tem essa linha na tabela). Não foi tocado — a
    numeração autoritativa é a tabela do §6 —, mas os dois "13)" convivem no arquivo;
    vale renumeração dos comentários numa limpeza futura.
  - A varredura de avisos lê `.ts`/`.tsx` de `src/`; uma marca escrita só em `.js` não
    seria vista (não é o caso hoje).
