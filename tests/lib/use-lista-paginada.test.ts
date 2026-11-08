import { describe, expect, it } from "vitest";
import {
  deveUsarInicial,
  temFiltrosAtivos,
  filtroAtivo,
} from "@/lib/use-lista-paginada";

/**
 * Regressão do filtro perdido após `router.refresh()`: o resultado inicial do
 * servidor só pode substituir o recorte quando não há busca nem filtro ativo.
 */
describe("useListaPaginada — decisão do refresh", () => {
  it("usa o inicial sem busca e sem filtros", () => {
    expect(deveUsarInicial("", {})).toBe(true);
    expect(deveUsarInicial("", { status: undefined, de: "" })).toBe(true);
    expect(deveUsarInicial("", { status: [] })).toBe(true);
  });

  it("não usa o inicial quando há busca ativa", () => {
    expect(deveUsarInicial("ab", {})).toBe(false);
    expect(deveUsarInicial("motorista", {})).toBe(false);
  });

  it("busca de 1 caractere continua usando o inicial (mesma regra do hook)", () => {
    expect(deveUsarInicial("a", {})).toBe(true);
  });

  it("não usa o inicial quando há filtro ativo", () => {
    expect(deveUsarInicial("", { status: ["PENDENTE"] })).toBe(false);
    expect(deveUsarInicial("", { id_destinatario: [3] })).toBe(false);
    expect(deveUsarInicial("", { ativo: false })).toBe(false);
    expect(deveUsarInicial("", { ativo: null })).toBe(false);
    expect(deveUsarInicial("", { perecivel: true })).toBe(false);
    expect(deveUsarInicial("", { de: "2026-11-01" })).toBe(false);
  });

  it("mantém o recorte de Situação “Ativos + Inativos” (null) após o refresh", () => {
    // `null` é o recorte explícito "todos", diferente do default (só ativos):
    // `router.refresh()` não pode trocar a lista pelo inicial nesse caso.
    const filtros = { ativo: null };
    expect(temFiltrosAtivos(filtros)).toBe(true);
    expect(deveUsarInicial("", filtros)).toBe(false);
  });

  it("classifica valores explícitos como ativos e os vazios como inativos", () => {
    expect(filtroAtivo(undefined)).toBe(false);
    expect(filtroAtivo(null)).toBe(true);
    expect(filtroAtivo("")).toBe(false);
    expect(filtroAtivo("   ")).toBe(false);
    expect(filtroAtivo([])).toBe(false);
    expect(filtroAtivo(0)).toBe(true);
    expect(filtroAtivo(false)).toBe(true);
    expect(filtroAtivo([" "])).toBe(true);
  });

  it("temFiltrosAtivos combina as chaves", () => {
    expect(temFiltrosAtivos({ a: undefined, b: [], c: "" })).toBe(false);
    expect(temFiltrosAtivos({ a: undefined, b: null })).toBe(true);
    expect(temFiltrosAtivos({ a: undefined, b: ["x"] })).toBe(true);
  });
});
