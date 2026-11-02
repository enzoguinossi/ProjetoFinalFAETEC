import { describe, expect, it } from "vitest";
import {
  descricaoEvento,
  normalizarEntidade,
  rotuloAcao,
  rotuloEntidade,
  acaoTemDiff,
} from "@/lib/auditoria";

const semReferencias = new Map<string, string>();

describe("auditoria — rótulos", () => {
  it("normaliza a entidade para snake_case", () => {
    expect(normalizarEntidade("NotaSaida")).toBe("nota_saida");
    expect(normalizarEntidade("nota_saida")).toBe("nota_saida");
    expect(normalizarEntidade("ItemNotaSaida")).toBe("item_nota_saida");
    expect(normalizarEntidade("Usuario")).toBe("usuario");
  });

  it("rotula as entidades conhecidas e humaniza as desconhecidas", () => {
    expect(rotuloEntidade("NotaSaida")).toBe("Nota de saída");
    expect(rotuloEntidade("nota_saida")).toBe("Nota de saída");
    expect(rotuloEntidade("expedicao")).toBe("Expedição");
    expect(rotuloEntidade("foo_bar")).toBe("Foo bar");
  });

  it("rotula as ações", () => {
    expect(rotuloAcao("CRIAR")).toBe("Criar");
    expect(rotuloAcao("LOGIN_FALHA")).toBe("Falha de login");
    expect(rotuloAcao("ALTERAR")).toBe("Alterar");
    expect(rotuloAcao("teste")).toBe("Teste");
  });

  it("indica ações de autenticação sem diff", () => {
    expect(acaoTemDiff("CRIAR")).toBe(true);
    expect(acaoTemDiff("LOGIN")).toBe(false);
    expect(acaoTemDiff("LOGOUT")).toBe(false);
    expect(acaoTemDiff("LOGIN_FALHA")).toBe(false);
  });
});

describe("descricaoEvento", () => {
  const base = {
    entidade: "Produto",
    id_entidade_afetada: 9,
    dados_anteriores: null as unknown,
    dados_novos: null as unknown,
  };

  it("usa a descrição do snapshot", () => {
    expect(
      descricaoEvento(
        { ...base, dados_novos: { descricao: "Lápis de cor" } },
        semReferencias,
      ),
    ).toBe("Lápis de cor");
    expect(
      descricaoEvento(
        { ...base, dados_novos: { razao_social: "Escola A" } },
        semReferencias,
      ),
    ).toBe("Escola A");
  });

  it("cai para dados_anteriores quando o novo não tem descrição", () => {
    expect(
      descricaoEvento(
        { ...base, dados_anteriores: { nome: "Ana" }, dados_novos: {} },
        semReferencias,
      ),
    ).toBe("Ana");
  });

  it("usa a referência resolvida quando o snapshot não descreve", () => {
    const referencias = new Map([["nota_saida:10", "Escola B"]]);
    expect(
      descricaoEvento(
        { ...base, entidade: "NotaSaida", id_entidade_afetada: 10 },
        referencias,
      ),
    ).toBe("Escola B");
  });

  it("devolve null sem descrição", () => {
    expect(descricaoEvento(base, semReferencias)).toBeNull();
    expect(
      descricaoEvento({ ...base, id_entidade_afetada: null }, semReferencias),
    ).toBeNull();
  });
});
