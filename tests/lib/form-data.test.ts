import { describe, expect, it } from "vitest";
import {
  lerEnderecoDoFormData,
  lerEnderecoParcialDoFormData,
  lerJson,
  parsePermissoes,
} from "@/lib/form-data";

describe("lerJson", () => {
  it("retorna null para campo ausente ou JSON inválido", () => {
    expect(lerJson(new FormData(), "campo")).toBeNull();
    const invalido = new FormData();
    invalido.set("campo", "{nao é json");
    expect(lerJson(invalido, "campo")).toBeNull();
  });

  it("retorna o valor decodificado", () => {
    const fd = new FormData();
    fd.set("campo", JSON.stringify({ a: [1, 2] }));
    expect(lerJson(fd, "campo")).toEqual({ a: [1, 2] });
  });
});

describe("parsePermissoes", () => {
  it("lê um array JSON de strings", () => {
    const fd = new FormData();
    fd.set("permissoes", JSON.stringify(["produto.listar", "produto.criar"]));
    expect(parsePermissoes(fd)).toEqual(["produto.listar", "produto.criar"]);
  });

  it("ignora itens que não são string", () => {
    const fd = new FormData();
    fd.set("permissoes", JSON.stringify(["ok", 1, null, { a: 1 }]));
    expect(parsePermissoes(fd)).toEqual(["ok"]);
  });

  it("retorna vazio para ausente, inválido ou não-array", () => {
    expect(parsePermissoes(new FormData())).toEqual([]);
    const invalido = new FormData();
    invalido.set("permissoes", "{nao é json");
    expect(parsePermissoes(invalido)).toEqual([]);
    const naoArray = new FormData();
    naoArray.set("permissoes", JSON.stringify({ a: 1 }));
    expect(parsePermissoes(naoArray)).toEqual([]);
  });
});

describe("lerEnderecoDoFormData", () => {
  it("lê e converte todos os campos", () => {
    const fd = new FormData();
    fd.set("logradouro", "Rua A");
    fd.set("numero", "10");
    fd.set("complemento", "Fundos");
    fd.set("bairro", "Centro");
    fd.set("cidade", "Rio de Janeiro");
    fd.set("uf", "RJ");
    fd.set("cep", "20040002");
    fd.set("latitude", "-22.9");
    fd.set("longitude", "-43.2");

    expect(lerEnderecoDoFormData(fd)).toEqual({
      logradouro: "Rua A",
      numero: "10",
      complemento: "Fundos",
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      cep: "20040002",
      latitude: -22.9,
      longitude: -43.2,
    });
  });

  it("usa string vazia para campos obrigatórios e undefined para opcionais", () => {
    expect(lerEnderecoDoFormData(new FormData())).toEqual({
      logradouro: "",
      numero: undefined,
      complemento: undefined,
      bairro: undefined,
      cidade: "",
      uf: undefined,
      cep: undefined,
      latitude: undefined,
      longitude: undefined,
    });
  });
});

describe("lerEnderecoParcialDoFormData", () => {
  it("converte campos vazios (inclusive obrigatórios) em undefined", () => {
    expect(lerEnderecoParcialDoFormData(new FormData())).toMatchObject({
      logradouro: undefined,
      cidade: undefined,
    });
  });

  it("mantém campos preenchidos", () => {
    const fd = new FormData();
    fd.set("cidade", "Niterói");
    expect(lerEnderecoParcialDoFormData(fd).cidade).toBe("Niterói");
  });
});
