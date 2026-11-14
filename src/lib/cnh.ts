/**
 * Dados de condutor do funcionário: CNH, categoria, validade e tipo sanguíneo.
 *
 * Todos são opcionais — a ficha do funcionário só os preenche quando ele atua
 * como condutor. As validações devolvem `{ ok: false, erro }` com a mensagem
 * pronta para a tela; vazio vira `null`.
 */

import { diaISOSaoPaulo, limitesDoDiaUtc } from "@/lib/datas";

export const CATEGORIAS_CNH = ["A", "B", "AB", "C", "D", "E"] as const;
export type CategoriaCnh = (typeof CATEGORIAS_CNH)[number];

export const TIPOS_SANGUINEOS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export type TipoSanguineo = (typeof TIPOS_SANGUINEOS)[number];

export type ResultadoCnh =
  | { ok: true; cnh: string | null }
  | { ok: false; erro: string };

export type ResultadoCategoriaCnh =
  | { ok: true; categoria: CategoriaCnh | null }
  | { ok: false; erro: string };

export type ResultadoTipoSanguineo =
  | { ok: true; tipo: TipoSanguineo | null }
  | { ok: false; erro: string };

export type ResultadoValidadeCnh =
  | { ok: true; validade: Date | null }
  | { ok: false; erro: string };

/** Número da CNH: só dígitos, exatamente 11. Vazio → sem CNH. */
export function validarCnh(valor: string): ResultadoCnh {
  const texto = valor.trim();
  if (!texto) return { ok: true, cnh: null };
  if (!/^\d{11}$/.test(texto)) {
    return { ok: false, erro: "A CNH deve conter 11 dígitos." };
  }
  return { ok: true, cnh: texto };
}

/** Categoria da CNH: uma da lista. Vazio → sem categoria. */
export function validarCategoriaCnh(valor: string): ResultadoCategoriaCnh {
  const texto = valor.trim().toUpperCase();
  if (!texto) return { ok: true, categoria: null };
  if (!(CATEGORIAS_CNH as readonly string[]).includes(texto)) {
    return { ok: false, erro: "Categoria da CNH inválida." };
  }
  return { ok: true, categoria: texto as CategoriaCnh };
}

/** Tipo sanguíneo: um da lista. Vazio → sem tipo. */
export function validarTipoSanguineo(valor: string): ResultadoTipoSanguineo {
  const texto = valor.trim().toUpperCase();
  if (!texto) return { ok: true, tipo: null };
  if (!(TIPOS_SANGUINEOS as readonly string[]).includes(texto)) {
    return { ok: false, erro: "Tipo sanguíneo inválido." };
  }
  return { ok: true, tipo: texto as TipoSanguineo };
}

/** Validade da CNH em `YYYY-MM-DD`. Vazio → sem validade; data inválida → erro. */
export function validarValidadeCnh(valor: string): ResultadoValidadeCnh {
  const texto = valor.trim();
  if (!texto) return { ok: true, validade: null };
  const { inicio } = limitesDoDiaUtc(texto, texto);
  if (!inicio) return { ok: false, erro: "Validade da CNH inválida." };
  return { ok: true, validade: inicio };
}

/** `true` quando a validade (dia civil de São Paulo) já passou. Vazio → `false`. */
export function cnhVencida(validade: string | null | undefined): boolean {
  if (!validade) return false;
  const texto = validade.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return texto < diaISOSaoPaulo(new Date());
}

/** Validade no formato `dd/mm/aaaa`; vazio ou inválida → `—`. */
export function formatarDataCnh(validade: string | null | undefined): string {
  if (!validade) return "—";
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(validade.trim());
  if (!partes) return "—";
  const [, ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}
