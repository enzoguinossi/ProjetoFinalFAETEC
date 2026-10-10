import { describe, expect, it } from "vitest";
import { contatoService } from "@/services/contato";

function formCom(entradas: {
  emails?: { endereco: string; principal?: boolean }[];
  telefones?: { numero: string; tipo?: string; principal?: boolean }[];
}) {
  const fd = new FormData();
  fd.set(
    "contatos",
    JSON.stringify({
      emails: (entradas.emails ?? []).map((e) => ({
        endereco: e.endereco,
        principal: e.principal ?? false,
      })),
      telefones: (entradas.telefones ?? []).map((t) => ({
        numero: t.numero,
        tipo: t.tipo ?? "CELULAR",
        principal: t.principal ?? false,
      })),
    }),
  );
  return fd;
}

describe("contatoService.resolverContatosParaSalvar", () => {
  it("valida e normaliza e-mails e telefones", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({
        emails: [{ endereco: " a@b.com ", principal: true }],
        telefones: [{ numero: "(21) 99999-8888", tipo: "CELULAR", principal: true }],
      }),
    );

    expect(resultado).toEqual({
      contatos: {
        emails: [{ endereco: "a@b.com", principal: true }],
        telefones: [{ numero: "21999998888", tipo: "CELULAR", principal: true }],
      },
    });
  });

  it("ignora linhas vazias", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({ emails: [{ endereco: "   " }], telefones: [{ numero: "  " }] }),
    );

    expect(resultado).toEqual({ contatos: { emails: [], telefones: [] } });
  });

  it("rejeita e-mail inválido", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({ emails: [{ endereco: "invalido" }] }),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("E-mail inválido") });
  });

  it("rejeita e-mail duplicado na lista", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({ emails: [{ endereco: "a@b.com" }, { endereco: "A@B.COM" }] }),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("E-mail duplicado") });
  });

  it("rejeita mais de um e-mail principal", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({
        emails: [
          { endereco: "a@b.com", principal: true },
          { endereco: "c@d.com", principal: true },
        ],
      }),
    );

    expect(resultado).toMatchObject({ error: "Apenas um e-mail pode ser o principal." });
  });

  it("rejeita telefone com tipo inválido", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({ telefones: [{ numero: "21999998888", tipo: "FAX" }] }),
    );

    expect(resultado).toMatchObject({ error: expect.stringContaining("Tipo de telefone inválido") });
  });

  it("rejeita telefone inválido e duplicado", () => {
    const invalido = contatoService.resolverContatosParaSalvar(
      formCom({ telefones: [{ numero: "123" }] }),
    );
    expect(invalido).toMatchObject({ error: expect.stringContaining("Telefone") });

    const duplicado = contatoService.resolverContatosParaSalvar(
      formCom({ telefones: [{ numero: "21999998888" }, { numero: "(21) 99999-8888" }] }),
    );
    expect(duplicado).toMatchObject({ error: expect.stringContaining("Telefone duplicado") });
  });

  it("rejeita mais de um telefone principal", () => {
    const resultado = contatoService.resolverContatosParaSalvar(
      formCom({
        telefones: [
          { numero: "21999998888", principal: true },
          { numero: "2133334444", principal: true },
        ],
      }),
    );

    expect(resultado).toMatchObject({ error: "Apenas um telefone pode ser o principal." });
  });

  it("trata JSON inválido ou ausente como listas vazias", () => {
    const invalido = new FormData();
    invalido.set("contatos", "{quebrado");
    expect(contatoService.resolverContatosParaSalvar(invalido)).toEqual({
      contatos: { emails: [], telefones: [] },
    });
    expect(contatoService.resolverContatosParaSalvar(new FormData())).toEqual({
      contatos: { emails: [], telefones: [] },
    });
  });

  it("rejeita payload com formato inesperado", () => {
    const naoObjeto = new FormData();
    naoObjeto.set("contatos", JSON.stringify("texto"));
    expect(contatoService.resolverContatosParaSalvar(naoObjeto)).toEqual({
      error: "Dados de contatos inválidos.",
    });

    const emailInvalido = new FormData();
    emailInvalido.set("contatos", JSON.stringify({ emails: [{ principal: true }] }));
    expect(contatoService.resolverContatosParaSalvar(emailInvalido)).toEqual({
      error: "Dados de contatos inválidos.",
    });

    const telefoneInvalido = new FormData();
    telefoneInvalido.set("contatos", JSON.stringify({ telefones: [{ numero: 123 }] }));
    expect(contatoService.resolverContatosParaSalvar(telefoneInvalido)).toEqual({
      error: "Dados de contatos inválidos.",
    });
  });
});
