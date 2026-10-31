import { afterAll, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prismaTeste } from "../helpers/prisma";
import { garantirUnidadePadrao } from "../helpers/factories";

const sessao = vi.hoisted(() => ({ id_usuario: 0 }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    id_usuario: sessao.id_usuario,
    super_admin: true,
  }),
}));

import {
  createProduto,
  deleteProduto,
  getProduto,
  updateProduto,
} from "@/app/produtos/actions";
import {
  createFuncionario,
  deleteFuncionario,
  getFuncionario,
  updateFuncionario,
} from "@/app/funcionarios/actions";
import { criarUsuario } from "../helpers/factories";

async function png(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
}

async function equipe() {
  const { usuario } = await criarUsuario();
  sessao.id_usuario = usuario.id_usuario;
  await garantirUnidadePadrao();
  return usuario;
}

function arquivoApp(url: string): string {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

const arquivos: string[] = [];

afterAll(async () => {
  for (const arquivo of arquivos) {
    await fs.rm(arquivo, { force: true });
  }
});

describe("foto do produto via Anexo", () => {
  it("cria, troca e exclui a foto mantendo um anexo ativo", async () => {
    await equipe();

    const form = new FormData();
    form.set("descricao", "Produto com foto");
    form.set(
      "foto_arquivo",
      new File([new Uint8Array(await png())], "produto.png", { type: "image/png" }),
    );

    const criado = await createProduto(form);
    expect("error" in criado).toBe(false);

    const produto = await prismaTeste.produto.findFirstOrThrow({
      where: { descricao: "Produto com foto" },
    });
    const anexos = await prismaTeste.anexo.findMany({
      where: { id_produto: produto.id_produto },
    });
    expect(anexos).toHaveLength(1);
    expect(anexos[0]!.url).toMatch(new RegExp(`^/uploads/produtos/${produto.id_produto}/`));
    arquivos.push(arquivoApp(anexos[0]!.url));
    await expect(fs.stat(arquivoApp(anexos[0]!.url))).resolves.toBeTruthy();

    const detalhe = await getProduto(produto.id_produto);
    expect(detalhe?.foto_url).toBe(anexos[0]!.url);
    expect(detalhe?.fotos).toHaveLength(1);

    // Troca: novo arquivo, anterior desativado e removido do disco.
    const urlAntiga = anexos[0]!.url;
    const edicao = new FormData();
    edicao.set("id_produto", String(produto.id_produto));
    edicao.set("descricao", "Produto com foto");
    edicao.set("ativo", "on");
    edicao.set(
      "foto_arquivo",
      new File([new Uint8Array(await png())], "produto-novo.png", { type: "image/png" }),
    );

    const atualizado = await updateProduto(edicao);
    expect("error" in atualizado).toBe(false);

    const depois = await getProduto(produto.id_produto);
    expect(depois?.fotos).toHaveLength(1);
    expect(depois?.foto_url).not.toBe(urlAntiga);
    arquivos.push(arquivoApp(depois!.foto_url!));

    const antigos = await prismaTeste.anexo.findMany({
      where: { id_produto: produto.id_produto },
      orderBy: { id_anexo: "asc" },
    });
    expect(antigos.map((a) => a.ativo)).toEqual([false, true]);
    await expect(fs.stat(arquivoApp(urlAntiga))).rejects.toThrow();

    const auditoria = await prismaTeste.registroAuditoria.findFirst({
      where: { entidade: "Anexo", acao: "DESATIVAR" },
      orderBy: { id_registro_auditoria: "desc" },
    });
    expect(auditoria).not.toBeNull();

    const excluido = await deleteProduto(produto.id_produto);
    expect("error" in excluido).toBe(false);
    expect(await prismaTeste.anexo.count({ where: { id_produto: produto.id_produto } })).toBe(0);
    await expect(fs.stat(arquivoApp(depois!.foto_url!))).rejects.toThrow();
  });

  it("remove a foto marcada em remover_anexos", async () => {
    await equipe();

    const form = new FormData();
    form.set("descricao", "Produto sem foto depois");
    form.set(
      "foto_arquivo",
      new File([new Uint8Array(await png())], "remover.png", { type: "image/png" }),
    );
    await createProduto(form);
    const produto = await prismaTeste.produto.findFirstOrThrow({
      where: { descricao: "Produto sem foto depois" },
    });
    const anexo = await prismaTeste.anexo.findFirstOrThrow({
      where: { id_produto: produto.id_produto },
    });
    arquivos.push(arquivoApp(anexo.url));

    const edicao = new FormData();
    edicao.set("id_produto", String(produto.id_produto));
    edicao.set("descricao", "Produto sem foto depois");
    edicao.set("ativo", "on");
    edicao.set("remover_anexos", String(anexo.id_anexo));
    const resultado = await updateProduto(edicao);
    expect("error" in resultado).toBe(false);

    const detalhe = await getProduto(produto.id_produto);
    expect(detalhe?.foto_url).toBeNull();
    await expect(fs.stat(arquivoApp(anexo.url))).rejects.toThrow();
  });
});

describe("foto do funcionário via Anexo", () => {
  it("cria, troca e exclui a foto do funcionário", async () => {
    await equipe();

    const form = new FormData();
    form.set("nome", "Funcionário com foto");
    form.set(
      "foto_arquivo",
      new File([new Uint8Array(await png())], "funcionario.png", { type: "image/png" }),
    );
    const criado = await createFuncionario(form);
    expect("error" in criado).toBe(false);

    const func = await prismaTeste.funcionario.findFirstOrThrow({
      where: { pessoaFisica: { nome: "Funcionário com foto" } },
    });
    const anexos = await prismaTeste.anexo.findMany({
      where: { id_funcionario: func.id_funcionario },
    });
    expect(anexos).toHaveLength(1);
    arquivos.push(arquivoApp(anexos[0]!.url));

    const detalhe = await getFuncionario(func.id_funcionario);
    expect(detalhe?.foto_url).toBe(anexos[0]!.url);

    const urlAntiga = anexos[0]!.url;
    const edicao = new FormData();
    edicao.set("id_funcionario", String(func.id_funcionario));
    edicao.set("nome", "Funcionário com foto");
    edicao.set("ativo", "on");
    edicao.set(
      "foto_arquivo",
      new File([new Uint8Array(await png())], "funcionario-novo.png", { type: "image/png" }),
    );
    const atualizado = await updateFuncionario(edicao);
    expect("error" in atualizado).toBe(false);

    const depois = await getFuncionario(func.id_funcionario);
    expect(depois?.foto_url).not.toBe(urlAntiga);
    arquivos.push(arquivoApp(depois!.foto_url!));
    await expect(fs.stat(arquivoApp(urlAntiga))).rejects.toThrow();

    const excluido = await deleteFuncionario(func.id_funcionario);
    expect("error" in excluido).toBe(false);
    await expect(fs.stat(arquivoApp(depois!.foto_url!))).rejects.toThrow();
  });
});
