/**
 * Tokens globais do app — a **fonte única** dos tokens de design.
 *
 * Os tokens existiam copiados à mão dentro do plugin (`TOKENS_COR`/
 * `TOKENS_METRICA`) e por isso ficaram desatualizados quando o `globals.css`
 * mudou. Agora a colheita lê `src/app/globals.css`, grava o resultado no
 * manifesto (`scenes.json`) e o plugin apenas **aplica** o que veio de lá
 * (atualizando os existentes e criando os novos — ver `garantirVariaveis`).
 *
 * A leitura usa a mesma regex de `diff.ts#lerTokensCss` (que já remove
 * comentários) para que a colheita e o `figma:diff` enxerguem exatamente os
 * mesmos tokens.
 *
 * Uso: `lerTokensGlobais()` (a colheita chama e leva o resultado no manifesto).
 */
import { existsSync, readFileSync } from "node:fs";

import { GLOBALS_CSS } from "./config";

export interface TokensGlobais {
  /** `--color-<x>: <hex>` → `cores[x] = "#rrggbb"` (chave sem o prefixo `color-`). */
  cores: Record<string, string>;
  /** Demais medidas, já convertidas para px (`rem` a 16px de base). */
  metricas: Record<string, number>;
}

/**
 * Aliases legados do `:root` — são **duplicatas** das cores já declaradas em
 * `@theme` (`--green` = `--color-brand`, `--text-dark` = `--color-ink`, …).
 * Ficam de fora para não gerar variável repetida no Figma, com nome herdado de
 * um CSS antigo, sem nenhum ganho: quem manda na paleta é o `@theme`.
 */
const ALIASES_LEGADOS = new Set([
  "--green",
  "--green-hover",
  "--text-dark",
  "--border-light",
  "--hover-bg",
  "--table-alt",
  "--alert",
]);

/** Base do `rem` assumida na exportação (a mesma de `diff.ts#normalizar`). */
const BASE_REM = 16;

/** `#abc` → `#aabbcc` (o plugin lê os hex como `#rrggbb`). */
function expandirHex(valor: string): string | null {
  const curto = valor.match(/^#([0-9a-f]{3})$/);
  if (curto) {
    return (
      "#" +
      curto[1]
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  if (/^#[0-9a-f]{6}$/.test(valor)) return valor;
  return null;
}

/** Valor de medida em px (`rem`/`px`/número puro), ou `null` se não for medida. */
function comoPx(valor: string): number | null {
  const rem = valor.match(/^(-?[\d.]+)rem$/);
  if (rem) return arredondar(Number(rem[1]) * BASE_REM);
  const px = valor.match(/^(-?[\d.]+)px$/);
  if (px) return arredondar(Number(px[1]));
  const numero = valor.match(/^(-?[\d.]+)$/);
  if (numero) return arredondar(Number(numero[1]));
  return null;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Lê os tokens globais de `src/app/globals.css`.
 *
 * - `--color-<x>: <hex>` → `cores[x]` (sem o prefixo `color-`);
 * - `--<x>: <rem|px|número>` (exceto `--color-*`, `--font-*` e valores
 *   `var(...)`) → `metricas[x]` em px;
 * - aliases legados do `:root` são ignorados (ver `ALIASES_LEGADOS`).
 *
 * Nunca devolve tabela vazia: uma colheita sem tokens geraria coleções vazias
 * no Figma, e o erro apareceria só lá dentro.
 */
export function lerTokensGlobais(): TokensGlobais {
  if (!existsSync(GLOBALS_CSS)) {
    throw new Error(`globals.css não encontrado em ${GLOBALS_CSS}`);
  }

  const cores: Record<string, string> = {};
  const metricas: Record<string, number> = {};
  const css = readFileSync(GLOBALS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  for (const achado of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const nome = "--" + achado[1].toLowerCase();
    const valor = achado[2].trim().toLowerCase();
    if (ALIASES_LEGADOS.has(nome)) continue;

    if (nome.indexOf("--color-") === 0) {
      // cor que não é hex (var/oklch/...) não tem como virar variável COLOR no
      // Figma: fica de fora em vez de quebrar a importação
      const hex = expandirHex(valor);
      if (hex) cores[nome.slice("--color-".length)] = hex;
      continue;
    }

    if (nome.indexOf("--font-") === 0 || valor.indexOf("var(") >= 0) continue;

    const px = comoPx(valor);
    if (px !== null) metricas[nome.slice(2)] = px;
  }

  const total = Object.keys(cores).length + Object.keys(metricas).length;
  if (total === 0) {
    throw new Error(
      `nenhum token encontrado em ${GLOBALS_CSS} — o formato do globals.css mudou?`,
    );
  }
  if (!Object.keys(cores).length || !Object.keys(metricas).length) {
    throw new Error(
      `tokens incompletos em ${GLOBALS_CSS}: ${Object.keys(cores).length} cor(es) e ` +
        `${Object.keys(metricas).length} métrica(s) — os dois grupos são obrigatórios.`,
    );
  }

  return { cores, metricas };
}
