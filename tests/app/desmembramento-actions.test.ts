import { afterEach, describe, expect, it, vi } from "vitest";
import {
  criarEstoque,
  criarProduto,
  criarProdutoInsumo,
  criarUsuario,
} from "../helpers/factories";

/**
 * O servidor é a barreira de permissão: desmembrar exige `estoque.entrada` e
 * `estoque.saida`. O serviço é mockado para provar que, sem uma delas, ele não
 * é chamado; a prévia exercita o produto real do banco de teste.
 */
const sessao = vi.hoisted(() => ({ id_usuario: 0 }));
const permissoes = vi.hoisted(() => ({ nomes: [] as string[] }));
const servico = vi.hoisted(() => ({ desmembrar: vi.fn() }));
const revalidar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    id_usuario: sessao.id_usuario,
    super_admin: false,
  }),
}));

vi.mock("@/services/permissao", () => ({
  permissaoService: {
    listarPorUsuario: async () => permissoes.nomes,
  },
}));

vi.mock("@/services/desmembramento", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/desmembramento")>();
  return {
    ...actual,
    desmembramentoService: { desmembrar: servico.desmembrar },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: revalidar }));

import {
  desmembrarProduto,
  previewDesmembramento,
} from "@/app/produtos/actions";

function formulario(id: number, quantidade: number) {
  const formData = new FormData();
  formData.set("id_produto", String(id));
  formData.set("quantidade", String(quantidade));
  return formData;
}

describe("actions do desmembramento", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    revalidar.mockReset();
  });

  it("recusa sem estoque.entrada e não chama o serviço", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.saida"];
    servico.desmembrar.mockClear();

    const resultado = await desmembrarProduto(formulario(7, 1));

    expect(resultado).toEqual({ error: "Sem permissão." });
    expect(servico.desmembrar).not.toHaveBeenCalled();
  });

  it("recusa sem estoque.saida e não chama o serviço", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada"];
    servico.desmembrar.mockClear();

    const resultado = await desmembrarProduto(formulario(7, 1));

    expect(resultado).toEqual({ error: "Sem permissão." });
    expect(servico.desmembrar).not.toHaveBeenCalled();
  });

  it("com as duas permissões grava e devolve as duas notas", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];
    servico.desmembrar.mockReset();
    servico.desmembrar.mockResolvedValue({
      id_nota_saida: 12,
      id_nota_entrada: 34,
      aviso: null,
      saldos: {
        produto: {
          id_produto: 7,
          saldo_anterior: 10,
          saldo_posterior: 8,
          saldo_reservado: 0,
        },
        insumos: [],
      },
    });
    revalidar.mockClear();

    const resultado = await desmembrarProduto(formulario(7, 2));

    expect(resultado).toEqual({
      success: true,
      notaSaida: { id_nota_saida: 12, codigo: "000012" },
      notaEntrada: { id_nota_entrada: 34, codigo: "000034" },
      aviso: null,
    });
    expect(servico.desmembrar).toHaveBeenCalledWith({
      id_produto: 7,
      quantidade: 2,
      id_usuario: usuario.id_usuario,
      observacao: null,
    });
    expect(revalidar).toHaveBeenCalledWith("/produtos");
    expect(revalidar).toHaveBeenCalledWith("/mov-estoque/entrada");
    expect(revalidar).toHaveBeenCalledWith("/mov-estoque/saida");
  });

  it("devolve o aviso de RN001 sem transformar em erro", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];
    servico.desmembrar.mockResolvedValue({
      id_nota_saida: 1,
      id_nota_entrada: 2,
      aviso: "Saldo insuficiente (RN001).",
      saldos: {
        produto: {
          id_produto: 7,
          saldo_anterior: 1,
          saldo_posterior: -1,
          saldo_reservado: 0,
        },
        insumos: [],
      },
    });

    const resultado = await desmembrarProduto(formulario(7, 2));

    expect(resultado).toMatchObject({
      success: true,
      aviso: "Saldo insuficiente (RN001).",
    });
  });

  it("entrega a prévia do composto com os insumos agregados", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const pai = await criarProduto({ descricao: "Kit", composto: true });
    const filho = await criarProduto({ descricao: "Lápis" });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 2);
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 3);
    await criarEstoque(pai.id_produto, { quantidadeAtual: 5, saldoReservado: 1 });
    await criarEstoque(filho.id_produto, { quantidadeAtual: 4 });

    const previa = await previewDesmembramento(pai.id_produto);

    expect("error" in previa).toBe(false);
    if ("error" in previa) return;
    expect(previa.produto).toMatchObject({
      id_produto: pai.id_produto,
      descricao: "Kit",
      saldo: 5,
      saldo_reservado: 1,
      disponivel: 4,
      composto: true,
      ativo: true,
    });
    expect(previa.insumos).toEqual([
      {
        id_produto: filho.id_produto,
        descricao: "Lápis",
        quantidade_por_unidade: 5,
        saldo: 4,
      },
    ]);
  });

  it("prévia sem as duas permissões retorna erro", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada"];

    expect(await previewDesmembramento(1)).toEqual({
      error: "Sem permissão.",
    });
  });

  it("prévia recusa produto inativo", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const pai = await criarProduto({
      descricao: "Kit inativo",
      composto: true,
      ativo: false,
    });
    const filho = await criarProduto({ descricao: "Lápis" });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 2);

    expect(await previewDesmembramento(pai.id_produto)).toEqual({
      error: "Produto inativo não pode ser desmembrado.",
    });
  });

  it("prévia recusa insumo inativo com a mesma mensagem do serviço", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const pai = await criarProduto({ descricao: "Kit", composto: true });
    const filho = await criarProduto({ descricao: "Cola", ativo: false });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 2);

    expect(await previewDesmembramento(pai.id_produto)).toEqual({
      error:
        'Reative o(s) insumo(s) "Cola" ou ajuste o composto antes de desmembrar.',
    });
  });

  it("prévia recusa insumo com quantidade zero, como o serviço", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const pai = await criarProduto({ descricao: "Kit", composto: true });
    const filho = await criarProduto({ descricao: "Lápis" });
    await criarProdutoInsumo(pai.id_produto, filho.id_produto, 0);

    expect(await previewDesmembramento(pai.id_produto)).toEqual({
      error:
        'O insumo "Lápis" tem quantidade inválida no cadastro do composto.',
    });
  });

  it("prévia recusa produto não composto", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const simples = await criarProduto({ composto: false });

    expect(await previewDesmembramento(simples.id_produto)).toEqual({
      error: "O produto não é composto e não pode ser desmembrado.",
    });
  });

  it("prévia recusa composto sem insumos ativos", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    const pai = await criarProduto({ composto: true });

    expect(await previewDesmembramento(pai.id_produto)).toEqual({
      error: "O produto não possui insumos ativos para desmembrar.",
    });
  });

  it("prévia de produto inexistente retorna erro", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];

    expect(await previewDesmembramento(999999)).toEqual({
      error: "Produto não encontrado.",
    });
  });

  it("mantém o sucesso quando a revalidação falha depois do commit", async () => {
    const { usuario } = await criarUsuario();
    sessao.id_usuario = usuario.id_usuario;
    permissoes.nomes = ["estoque.entrada", "estoque.saida"];
    servico.desmembrar.mockResolvedValue({
      id_nota_saida: 12,
      id_nota_entrada: 34,
      aviso: null,
      saldos: {
        produto: {
          id_produto: 7,
          saldo_anterior: 10,
          saldo_posterior: 8,
          saldo_reservado: 0,
        },
        insumos: [],
      },
    });
    revalidar.mockImplementation(() => {
      throw new Error("revalidatePath indisponível");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await desmembrarProduto(formulario(7, 2));

    expect(resultado).toEqual({
      success: true,
      notaSaida: { id_nota_saida: 12, codigo: "000012" },
      notaEntrada: { id_nota_entrada: 34, codigo: "000034" },
      aviso: null,
    });
  });
});
