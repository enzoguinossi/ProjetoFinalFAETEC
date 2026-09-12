import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Nexus...");

  // ── Tipos de Código ──────────────────────────────────────────────
  const tiposCodigo = [
    { nome: "DIGITACAO", descricao: "Apelido livre para digitação rápida" },
    { nome: "EAN12", descricao: "Código de barras de 12 dígitos" },
    { nome: "EAN13", descricao: "Código de barras de 13 dígitos" },
    { nome: "COD_FORNECEDOR", descricao: "Código usado pelo fornecedor" },
    { nome: "COD_ESCOLA", descricao: "Código da escola/creche" },
    { nome: "MATRICULA", descricao: "Matrícula funcional do funcionário" },
  ];

  for (const tc of tiposCodigo) {
    await prisma.tipoCodigo.upsert({
      where: { nome: tc.nome },
      update: {},
      create: tc,
    });
  }
  console.log("  ✅ Tipos de código");

  // ── Permissões ──────────────────────────────────────────────────
  const permissoes = [
    ...[
      "usuario", "funcionario", "destinatario", "fornecedor",
      "condutor", "veiculo", "produto", "perfil",
    ].flatMap((e) => [`${e}.criar`, `${e}.alterar`, `${e}.consultar`, `${e}.desativar`]),
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

  // ── Perfil Operador ─────────────────────────────────────────────
  const permissoesOperador = [
    "produto.consultar", "produto.criar",
    "estoque.entrada", "estoque.ver_saldo",
    "nota_saida.criar", "nota_saida.consultar", "nota_saida.alterar",
    "remessa.criar", "remessa.alterar_status", "remessa.finalizar",
    "destinatario.consultar",
    "inventario.contar",
  ];

  const perfilOperador = await prisma.perfil.upsert({
    where: { nome: "Operador" },
    update: {},
    create: { nome: "Operador", descricao: "Operador do galpão — Jonathan" },
  });

  for (const nome of permissoesOperador) {
    const permissao = await prisma.permissao.findUniqueOrThrow({ where: { nome } });
    await prisma.perfilPermissao.upsert({
      where: { id_perfil_id_permissao: { id_perfil: perfilOperador.id_perfil, id_permissao: permissao.id_permissao } },
      update: {},
      create: { id_perfil: perfilOperador.id_perfil, id_permissao: permissao.id_permissao },
    });
  }
  console.log("  ✅ Perfil Operador");

  // ── Perfil Auxiliar ─────────────────────────────────────────────
  const permissoesAuxiliar = [
    "nota_saida.consultar", "nota_saida.alterar",
    "estoque.ver_saldo", "estoque.saida",
    "produto.consultar",
    "inventario.contar",
    "relatorio.gerar",
  ];

  const perfilAuxiliar = await prisma.perfil.upsert({
    where: { nome: "Auxiliar" },
    update: {},
    create: { nome: "Auxiliar", descricao: "Auxiliar administrativo" },
  });

  for (const nome of permissoesAuxiliar) {
    const permissao = await prisma.permissao.findUniqueOrThrow({ where: { nome } });
    await prisma.perfilPermissao.upsert({
      where: { id_perfil_id_permissao: { id_perfil: perfilAuxiliar.id_perfil, id_permissao: permissao.id_permissao } },
      update: {},
      create: { id_perfil: perfilAuxiliar.id_perfil, id_permissao: permissao.id_permissao },
    });
  }
  console.log("  ✅ Perfil Auxiliar");

  console.log("\n✨ Seed concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());