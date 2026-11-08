import { describe, expect, it } from "vitest";
import { diaUtcSaoPaulo, limitesDoDiaSaoPaulo } from "@/lib/datas";

describe("diaUtcSaoPaulo", () => {
  it("devolve a meia-noite UTC do dia civil, mesmo depois das 21h em São Paulo", () => {
    // 01:30 UTC do dia 9 ainda é 22:30 do dia 8 em São Paulo (UTC-3).
    expect(diaUtcSaoPaulo(new Date("2026-11-09T01:30:00.000Z")).toISOString()).toBe(
      "2026-11-08T00:00:00.000Z",
    );
  });
});

describe("limitesDoDiaSaoPaulo", () => {
  it("devolve início e fim inclusivos do dia civil", () => {
    const { inicio, fim } = limitesDoDiaSaoPaulo("2020-01-01", "2020-01-02");
    expect(inicio?.toISOString()).toBe("2020-01-01T03:00:00.000Z");
    expect(fim?.toISOString()).toBe("2020-01-03T02:59:59.999Z");
  });

  it("aceita o fim de um dia histórico com horário de verão", () => {
    // Em janeiro de 2000 São Paulo estava em UTC-2: o fim do dia cai no dia
    // seguinte em UTC, mas o dia informado continua válido.
    const { inicio, fim } = limitesDoDiaSaoPaulo(null, "2000-01-02");
    expect(inicio).toBeNull();
    expect(fim).not.toBeNull();
  });

  it("descarta datas que o JS normalizaria", () => {
    expect(limitesDoDiaSaoPaulo("2026-02-31", "x")).toEqual({
      inicio: null,
      fim: null,
    });
  });
});
