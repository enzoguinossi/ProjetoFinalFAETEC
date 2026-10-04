import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * Seed de referência do Nexus.
 *
 * Popula apenas os dados fixos necessários para o sistema funcionar:
 *   - tipos de código
 *   - permissões (entidade.acao)
 *   - perfis-template (Operador / Auxiliar)
 *   - unidades de conversão
 *
 * Nenhum cadastro (usuários, funcionários, produtos, destinatários,
 * fornecedores, veículos) é criado aqui. O Super Admin é criado pelo
 * fluxo de primeiro acesso do próprio sistema.
 */
async function main() {
  console.log("🌱 Seeding Nexus...");

  // ── Tipos de Código ──────────────────────────────────────────────
  const tiposCodigo = [
    { nome: "DIGITACAO", descricao: "Apelido livre para digitação rápida" },
    { nome: "EAN12", descricao: "GTIN-12 / UPC-A — 12 dígitos numéricos" },
    { nome: "EAN13", descricao: "GTIN-13 / EAN-13 — 13 dígitos numéricos" },
    { nome: "COD_FORNECEDOR", descricao: "Código do produto no fornecedor" },
    { nome: "COD_ESCOLA", descricao: "Código da escola/creche" },
    { nome: "MATRICULA", descricao: "Matrícula funcional do funcionário" },
  ];

  for (const tc of tiposCodigo) {
    await prisma.tipoCodigo.upsert({
      where: { nome: tc.nome },
      update: { descricao: tc.descricao, ativo: true },
      create: tc,
    });
  }
  console.log("  ✅ Tipos de código");

  // ── Permissões ──────────────────────────────────────────────────
  const entidadesCadastro = ["usuario", "funcionario", "destinatario", "fornecedor", "veiculo", "produto"];

  const entidadesComPerfil = [...entidadesCadastro, "perfil"];

  const permissoes = [
    ...entidadesComPerfil.flatMap((e) => [
      `${e}.listar`, `${e}.criar`, `${e}.alterar`, `${e}.consultar`,
    ]),
    ...entidadesCadastro.map((e) => `${e}.desativar`),
    ...entidadesCadastro.map((e) => `${e}.excluir`),
    "perfil.excluir",
    "unidade_conversao.listar", "unidade_conversao.criar", "unidade_conversao.alterar",
    "unidade_conversao.consultar", "unidade_conversao.excluir",
    "estoque.entrada", "estoque.saida", "estoque.ver_saldo",
    "nota_entrada.criar", "nota_entrada.alterar", "nota_entrada.consultar", "nota_entrada.cancelar",
    "nota_saida.criar", "nota_saida.alterar", "nota_saida.consultar", "nota_saida.cancelar",
    "remessa.criar", "remessa.alterar_status", "remessa.finalizar",
    "inventario.abrir", "inventario.contar", "inventario.aprovar_ajuste", "inventario.ver_contagem_cega",
    "relatorio.gerar",
    "mural.criar", "mural.alterar", "mural.excluir",
  ];

  for (const nome of permissoes) {
    await prisma.permissao.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }
  console.log(`  ✅ ${permissoes.length} permissões`);

  // ── Limpeza: perfis não são mais desativados ────────────────────
  const obsoleta = await prisma.permissao.findUnique({ where: { nome: "perfil.desativar" } });
  if (obsoleta) {
    await prisma.perfilPermissao.deleteMany({ where: { id_permissao: obsoleta.id_permissao } });
    await prisma.usuarioPermissao.deleteMany({ where: { id_permissao: obsoleta.id_permissao } });
    await prisma.permissao.delete({ where: { id_permissao: obsoleta.id_permissao } });
    console.log("  ✅ Permissão obsoleta perfil.desativar removida");
  }

  // ── Perfis-template ─────────────────────────────────────────────
  const perfis = [
    {
      nome: "Operador",
      descricao: "Operador do galpão",
      permissoes: [
        "produto.consultar", "produto.criar",
        "estoque.entrada", "estoque.ver_saldo",
        "nota_saida.criar", "nota_saida.consultar", "nota_saida.alterar",
        "remessa.criar", "remessa.alterar_status", "remessa.finalizar",
        "destinatario.consultar",
        "inventario.contar",
      ],
    },
    {
      nome: "Auxiliar",
      descricao: "Auxiliar administrativo",
      permissoes: [
        "nota_saida.consultar", "nota_saida.alterar",
        "estoque.ver_saldo", "estoque.saida",
        "produto.consultar",
        "inventario.contar",
        "relatorio.gerar",
      ],
    },
  ];

  for (const p of perfis) {
    const perfil = await prisma.perfil.upsert({
      where: { nome: p.nome },
      update: { descricao: p.descricao },
      create: { nome: p.nome, descricao: p.descricao },
    });

    for (const nome of p.permissoes) {
      const permissao = await prisma.permissao.findUniqueOrThrow({ where: { nome } });
      await prisma.perfilPermissao.upsert({
        where: { id_perfil_id_permissao: { id_perfil: perfil.id_perfil, id_permissao: permissao.id_permissao } },
        update: {},
        create: { id_perfil: perfil.id_perfil, id_permissao: permissao.id_permissao },
      });
    }
    console.log(`  ✅ Perfil ${p.nome}`);
  }

  // ── Unidades de Conversão ───────────────────────────────────────
  const conversoes = [
    { nome: "UNIDADE", fator: 1, descricao: "Unidade avulsa" },
    { nome: "PACOTE", fator: 10, descricao: "Pacote com 10 unidades" },
    { nome: "CAIXA", fator: 50, descricao: "Caixa com 50 unidades" },
  ];

  for (const c of conversoes) {
    await prisma.conversaoUnidade.upsert({
      where: { nome: c.nome },
      update: { fator: c.fator, descricao: c.descricao },
      create: c,
    });
  }
  console.log("  ✅ Conversões de unidade");

  console.log("\n✨ Seed concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
