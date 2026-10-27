import { describe, expect, it, vi } from "vitest";
import { criarInventarioComItem, criarProduto, criarUsuario } from "../helpers/factories";
import { prismaTeste } from "../helpers/prisma";
import { inventarioDAO } from "@/dao/inventario";

const sessao = vi.hoisted(() => ({ id_usuario: 0 }));
const permissoes = vi.hoisted(() => ({ nomes: [] as string[] }));

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

import {
  abrirInventario,
  decidirAjuste,
  getInventario,
  getListaContagem,
  getRelatorioInventario,
  registrarContagem,
} from "@/app/inventario/actions";

async function preparar() {
  const { usuario } = await criarUsuario();
  sessao.id_usuario = usuario.id_usuario;
  const produto = await criarProduto({ descricao: "Produto cego" });
  const { inventario, item } = await criarInventarioComItem(
    produto.id_produto,
    usuario.id_usuario,
    { quantidadeSistema: 10 },
  );
  return { usuario, produto, inventario, item };
}

describe("actions do inventário — contagem cega", () => {
  it("não expõe quantidade_sistema sem estoque.ver_saldo", async () => {
    const { inventario } = await preparar();
    permissoes.nomes = ["inventario.contar"];

    const detalhe = await getInventario(inventario.id_inventario);
    expect(detalhe).not.toBeNull();
    expect(detalhe?.podeVerSistema).toBe(false);
    expect(detalhe?.itens[0]?.quantidade_sistema).toBeNull();
    expect(detalhe?.itens[0]?.saldo_reservado).toBeNull();
  });

  it("expõe quantidade_sistema com estoque.ver_saldo", async () => {
    const { inventario } = await preparar();
    permissoes.nomes = ["inventario.contar", "estoque.ver_saldo"];

    const detalhe = await getInventario(inventario.id_inventario);
    expect(detalhe?.podeVerSistema).toBe(true);
    expect(detalhe?.itens[0]?.quantidade_sistema).toBe(10);
  });

  it("mostra o sistema para todos quando a contagem cega está desligada", async () => {
    const { inventario } = await preparar();
    await prismaTeste.inventario.update({
      where: { id_inventario: inventario.id_inventario },
      data: { contagem_cega: false },
    });
    permissoes.nomes = ["inventario.contar"];

    const detalhe = await getInventario(inventario.id_inventario);
    expect(detalhe?.podeVerSistema).toBe(true);
    expect(detalhe?.itens[0]?.quantidade_sistema).toBe(10);
  });

  it("exige uma permissão do inventário", async () => {
    const { inventario } = await preparar();
    permissoes.nomes = ["estoque.ver_saldo"];
    expect(await getInventario(inventario.id_inventario)).toBeNull();
  });

  it("a lista impressa só mostra sistema com relatorio.gerar + estoque.ver_saldo", async () => {
    const { inventario } = await preparar();
    permissoes.nomes = ["relatorio.gerar", "inventario.contar"];

    const semSaldo = await getListaContagem(inventario.id_inventario, true);
    expect(semSaldo && !("error" in semSaldo) ? semSaldo.mostrarSistema : null).toBe(false);
    expect(semSaldo && !("error" in semSaldo) ? semSaldo.itens[0]?.quantidade_sistema : null).toBeNull();

    permissoes.nomes = ["relatorio.gerar", "inventario.contar", "estoque.ver_saldo"];
    const comSaldo = await getListaContagem(inventario.id_inventario, true);
    expect(comSaldo && !("error" in comSaldo) ? comSaldo.mostrarSistema : null).toBe(true);
    expect(comSaldo && !("error" in comSaldo) ? comSaldo.itens[0]?.quantidade_sistema : null).toBe(10);

    const semPedido = await getListaContagem(inventario.id_inventario, false);
    expect(semPedido && !("error" in semPedido) ? semPedido.mostrarSistema : null).toBe(false);
  });

  it("recusa a lista impressa sem relatorio.gerar", async () => {
    const { inventario } = await preparar();
    permissoes.nomes = ["inventario.contar", "estoque.ver_saldo"];
    expect(await getListaContagem(inventario.id_inventario, true)).toEqual({
      error: "Sem permissão.",
    });
  });

  it("recusa as mutações sem as permissões específicas do inventário", async () => {
    await preparar();
    permissoes.nomes = ["estoque.ver_saldo"];

    expect(
      await abrirInventario({
        observacao: "Sem permissão",
        contagem_cega: true,
        todos: true,
        id_produtos: [],
      }),
    ).toEqual({ error: "Sem permissão." });
    expect(
      await registrarContagem({
        id_inventario: 1,
        id_item_inventario: 1,
        quantidade: 1,
      }),
    ).toEqual({ error: "Sem permissão." });
    expect(
      await decidirAjuste({
        id_inventario: 1,
        id_produto: 1,
        origem: "MEDIA",
        status: "APROVADO",
      }),
    ).toEqual({ error: "Sem permissão." });
  });
  it("mascara sistema e movimentação no relatório sem estoque.ver_saldo", async () => {
    const { usuario, funcionario } = await criarUsuario();
    const produto = await criarProduto({ descricao: "Produto relatório" });
    await prismaTeste.produto.update({ where: { id_produto: produto.id_produto }, data: { saldo: 10 } });
    const inventario = await inventarioDAO.criar(
      { observacao: "Relatório mascarado", contagem_cega: true, todos: false, id_produtos: [produto.id_produto] },
      usuario.id_usuario,
    );
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    await inventarioDAO.contar(
      { id_inventario: inventario.id_inventario, id_item_inventario: detalhe!.itens[0]!.id_item_inventario, quantidade: 8, id_funcionario: funcionario.id_funcionario },
      usuario.id_usuario,
    );
    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);
    await inventarioDAO.decidirAjuste({ id_inventario: inventario.id_inventario, id_produto: produto.id_produto, origem: "MEDIA", status: "APROVADO", id_usuario: usuario.id_usuario });
    await inventarioDAO.finalizar(inventario.id_inventario, usuario.id_usuario);

    permissoes.nomes = ["relatorio.gerar", "inventario.aprovar_ajuste"];
    const semSaldo = await getRelatorioInventario(inventario.id_inventario);
    expect(semSaldo && "inventario" in semSaldo ? semSaldo.inventario.itens[0]?.quantidade_sistema : null).toBe(0);
    expect(semSaldo && "inventario" in semSaldo ? semSaldo.inventario.ajustes[0]?.movimentacoes : null).toEqual([]);
    expect(semSaldo && "inventario" in semSaldo ? Number(semSaldo.inventario.itens[0]?.produto.saldo) : null).toBe(0);

    permissoes.nomes = ["inventario.aprovar_ajuste"];
    const detalheSemSaldo = await getInventario(inventario.id_inventario);
    expect(detalheSemSaldo?.itens[0]?.quantidade_final).toBeNull();
    expect(detalheSemSaldo?.itens[0]?.media).toBeNull();
    expect(detalheSemSaldo?.itens[0]?.origem).toBeNull();
    expect(detalheSemSaldo?.itens[0]?.ajuste?.origem).toBeNull();
    expect(detalheSemSaldo?.itens[0]?.ajuste?.quantidade_contada).toBeNull();
    expect(detalheSemSaldo?.itens[0]?.ajuste?.movimentacao).toBeNull();

    permissoes.nomes = ["relatorio.gerar", "inventario.aprovar_ajuste", "estoque.ver_saldo"];
    const comSaldo = await getRelatorioInventario(inventario.id_inventario);
    expect(comSaldo && "inventario" in comSaldo ? comSaldo.inventario.itens[0]?.quantidade_sistema : null).toBe(10);
  });

});
