import { describe, expect, it } from "vitest";
import { inventarioDAO } from "@/dao/inventario";
import { criarEstoque, criarProduto, criarUsuario } from "../helpers/factories";
import { gerarCsvInventario, tabelaInventario } from "@/services/inventario";

describe("CSV do inventário", () => {
  it("exporta contagens, média, decisão e movimentação do inventário fechado", async () => {
    const { usuario, funcionario } = await criarUsuario();
    const produto = await criarProduto({ descricao: "Arroz para CSV" });
    await criarEstoque(produto.id_produto, { quantidadeAtual: 10 });
    const inventario = await inventarioDAO.criar(
      {
        observacao: "Fechado para CSV",
        contagem_cega: true,
        todos: false,
        id_produtos: [produto.id_produto],
      },
      usuario.id_usuario,
    );
    const detalhe = await inventarioDAO.getById(inventario.id_inventario);
    const item = detalhe!.itens[0]!;
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: item.id_item_inventario,
        quantidade: 8,
        id_funcionario: funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    await inventarioDAO.contar(
      {
        id_inventario: inventario.id_inventario,
        id_item_inventario: item.id_item_inventario,
        quantidade: 6,
        id_funcionario: (await criarUsuario()).funcionario.id_funcionario,
      },
      usuario.id_usuario,
    );
    await inventarioDAO.fecharContagem(inventario.id_inventario, usuario.id_usuario);
    await inventarioDAO.decidirAjuste({
      id_inventario: inventario.id_inventario,
      id_produto: produto.id_produto,
      origem: "MEDIA",
      status: "APROVADO",
      id_usuario: usuario.id_usuario,
    });
    await inventarioDAO.finalizar(inventario.id_inventario, usuario.id_usuario);

    const fechado = await inventarioDAO.getById(inventario.id_inventario);
    const csv = gerarCsvInventario(fechado!);

    expect(csv).toContain("Quantidade do sistema");
    expect(csv).toContain("Arroz para CSV");
    expect(csv).toContain("Média");
    expect(csv).toContain("Aprovado");
    expect(csv).toContain("Movimento");
    expect(csv).toContain("Fechado para CSV");

    const semSistema = gerarCsvInventario(fechado!, { incluirSistema: false });
    expect(semSistema).not.toContain("Quantidade do sistema");
    expect(semSistema).not.toContain("Saldo anterior");
    expect(semSistema).not.toContain("Saldo posterior");
    expect(semSistema).not.toContain("Quantidade contada");
    expect(semSistema).not.toContain("Sem ajuste");

    const tabela = tabelaInventario(fechado!);
    const linhaArroz = tabela.registros.find((registro) =>
      registro.includes("Arroz para CSV"),
    );
    expect(linhaArroz).toBeDefined();
    const indiceSistema = tabela.cabecalho.indexOf("Quantidade do sistema");
    const indiceMedia = tabela.cabecalho.indexOf("Média");
    const indiceContada = tabela.cabecalho.indexOf("Quantidade contada");
    expect(indiceSistema).toBeGreaterThanOrEqual(0);
    expect(typeof linhaArroz![indiceSistema]).toBe("number");
    expect(typeof linhaArroz![indiceMedia]).toBe("number");
    expect(typeof linhaArroz![indiceContada]).toBe("number");
    expect(typeof linhaArroz![tabela.cabecalho.indexOf("Saldo anterior")]).toBe(
      "number",
    );

    const tabelaSemSistema = tabelaInventario(fechado!, { incluirSistema: false });
    expect(tabelaSemSistema.cabecalho).not.toContain("Quantidade do sistema");
    expect(tabelaSemSistema.cabecalho).not.toContain("Saldo anterior");
    expect(tabelaSemSistema.cabecalho).not.toContain("Quantidade contada");
  });
});
