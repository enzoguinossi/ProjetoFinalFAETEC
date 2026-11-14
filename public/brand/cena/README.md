# Kit da cena do login

Peças soltas para montar o fundo do login e para a apresentação (cursor-craft).
Cada arquivo é um SVG independente, sem referência externa e com `viewBox` justo.

| Arquivo | viewBox | Papel | Âncora |
| --- | --- | --- | --- |
| `ceu.svg` | 1920×1080 | gradiente + brilho | full-bleed |
| `mapa.svg` | 1920×1080 | mapa-múndi pontilhado (Natural Earth 110m) | full-bleed |
| `grade.svg` | 1920×1080 | grade 9×7 | full-bleed |
| `nos.svg` | 1920×1080 | losangos dos cruzamentos | full-bleed |
| `caminhao.svg` | 280×72 | caminhão aprovado, com a estrada | topo-esquerda |
| `pino-azul.svg` | 64×84 | pino azul + sombra | ponta em (32, 76) |
| `pino-verde.svg` | 64×84 | pino verde + sombra | ponta em (32, 76) |
| `rastro.svg` | 110×64 | rastro pontilhado | topo-esquerda |

## Como a cena é montada

`src/components/cena/cena.json` é a única fonte da composição. O
`src/components/cena/Cena.tsx` lê o manifesto e renderiza **uma `<img>` por
camada**, na ordem do array.

- `fundo: true` — a peça ocupa o palco inteiro (`inset: 0; width/height 100%`).
- Demais peças — `x`/`y` em unidades do palco (1920×1080), `largura` natural do
  SVG e `escala`. A largura em % é `largura × escala / 1920`.
- `ancora: "ponta"` — o `x`/`y` é a ponta do pino; o componente aplica
  `translate(-50%, -90.476%)` (76/84 da altura do SVG).

O palco mantém 16:9 e cobre a viewport:

```css
width: max(100%, 177.7778vh);
aspect-ratio: 16 / 9;
```

Assim a composição é sempre a mesma, cortando as sobras nas laterais — como um
`background-size: cover`.

## Para acrescentar uma peça

1. Solte o SVG em `public/brand/cena/` com `viewBox` justo.
2. Acrescente uma entrada no `cena.json` com `id`, `arquivo`, `tipo`, `x`, `y`,
   `largura` e `escala`.
3. Para pinos, informe a ponta em `x`/`y` e `ancora: "ponta"`.

## Cursor-craft

O snapshot da ferramenta trata cada `<img>` como **um media task**. Por isso a
cena é feita de camadas separadas, e não de um SVG único:

- o mapa, a grade e os nós entram como três blocos (não faz sentido animar
  6.395 pontos);
- os cinco caminhões usam o mesmo `src` e são irmãos — caem no fluxo de
  **master + duplicates**;
- cada pino é um `<img>` próprio, com `data-cena-id` e `data-cena-tipo`, então
  pode ser montado, movido e revelado individualmente;
- não troque a cena por um `background-image` nem por um SVG inline único: isso
  viraria um bloco só na reconstrução.
