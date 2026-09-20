import "dotenv/config";
import bcrypt from "bcryptjs";
import { TipoDestinatario, StatusVeiculo } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

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
    ...["usuario", "funcionario", "destinatario", "fornecedor",
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

  // ── Conversão de Unidade ─────────────────────────────────────────
  const conversoes = [
    { nome: "UNIDADE", fator: 1, descricao: "Unidade avulsa" },
    { nome: "PACOTE", fator: 10, descricao: "Pacote com 10 unidades" },
    { nome: "CAIXA", fator: 50, descricao: "Caixa com 50 unidades" },
  ];

  for (const c of conversoes) {
    await prisma.conversaoUnidade.upsert({
      where: { nome: c.nome },
      update: {},
      create: c,
    });
  }
  console.log("  ✅ Conversões de unidade");

  // ── CADASTROS ─────────────────────────────────────────────────

  // ── Pessoas Físicas → Funcionários → Condutores ──
  const pf = [
    await prisma.pessoaFisica.upsert({
      where: { cpf: "529.834.160-01" },
      update: {},
      create: { nome: "João Ruan Oliveira", cpf: "529.834.160-01" },
    }),
    await prisma.pessoaFisica.upsert({
      where: { cpf: "762.918.340-05" },
      update: {},
      create: { nome: "Diego Santos", cpf: "762.918.340-05" },
    }),
    await prisma.pessoaFisica.upsert({
      where: { cpf: "384.056.720-90" },
      update: {},
      create: { nome: "Gabriel Pereira", cpf: "384.056.720-90" },
    }),
  ];
  console.log(`  ✅ ${pf.length} pessoas físicas`);

  const funcionarios = [];
  const cargos = ["Operador", "Aux. Administrativo", "Condutor"];
  for (let i = 0; i < pf.length; i++) {
    const f = await prisma.funcionario.upsert({
      where: { id_pessoa_fisica: pf[i].id_pessoa_fisica },
      update: {},
      create: {
        id_pessoa_fisica: pf[i].id_pessoa_fisica,
        cargo: cargos[i],
      },
    });
    funcionarios.push(f);
  }
  console.log(`  ✅ ${funcionarios.length} funcionários`);

  // Condutores (os 3 funcionários também são condutores)
  const condutoresData = [
    { cnh: "SP 123456789", categoria: "B", validade: new Date("2027-05-10") },
    { cnh: "RJ 987654321", categoria: "D", validade: new Date("2026-11-22") },
    { cnh: "MG 456789123", categoria: "AB", validade: new Date("2028-01-15") },
  ];

  for (let i = 0; i < funcionarios.length; i++) {
    await prisma.condutor.upsert({
      where: { id_funcionario: funcionarios[i].id_funcionario },
      update: {},
      create: {
        id_funcionario: funcionarios[i].id_funcionario,
        numero_cnh: condutoresData[i].cnh,
        categoria_cnh: condutoresData[i].categoria,
        validade_cnh: condutoresData[i].validade,
      },
    });
  }
  console.log(`  ✅ ${condutoresData.length} condutores`);

  // ── Pessoas Jurídicas → Fornecedores ──
  const pjFornecedores = [
    await prisma.pessoaJuridica.upsert({
      where: { cnpj: "12.345.678/0001-90" },
      update: {},
      create: { razao_social: "Distribuidora ABC Ltda.", cnpj: "12.345.678/0001-90" },
    }),
    await prisma.pessoaJuridica.upsert({
      where: { cnpj: "98.765.432/0001-10" },
      update: {},
      create: { razao_social: "Papelaria do Zé", cnpj: "98.765.432/0001-10" },
    }),
    await prisma.pessoaJuridica.upsert({
      where: { cnpj: "55.123.987/0001-55" },
      update: {},
      create: { razao_social: "Alimentos S.A.", cnpj: "55.123.987/0001-55" },
    }),
  ];

  for (const pj of pjFornecedores) {
    await prisma.fornecedor.upsert({
      where: { id_pessoa_juridica: pj.id_pessoa_juridica },
      update: {},
      create: {
        id_pessoa_juridica: pj.id_pessoa_juridica,
        contato: "Contato principal",
      },
    });
  }
  console.log(`  ✅ ${pjFornecedores.length} fornecedores`);

  // ── Endereços e Pessoas Jurídicas → Destinatários ──
  const enderecos = [
    await prisma.endereco.upsert({
      where: { id_endereco: 1 },
      update: {},
      create: {
        logradouro: "Rua das Flores",
        numero: "100",
        bairro: "Centro",
        cidade: "Teresópolis",
        cep: "25900-001",
      },
    }),
    await prisma.endereco.create({
      data: {
        logradouro: "Av. Principal",
        numero: "500",
        bairro: "Alto",
        cidade: "Teresópolis",
        cep: "25900-002",
      },
    }),
    await prisma.endereco.create({
      data: {
        logradouro: "Praça da Matriz",
        numero: "s/n",
        bairro: "Centro",
        cidade: "Teresópolis",
        cep: "25900-003",
      },
    }),
  ];

  const pjDestinatarios = [
    { razao: "EMEI Tia Nastácia", cnpj: "11.111.111/0001-11", tipo: TipoDestinatario.ESCOLA },
    { razao: "EMEF Professora Maria José", cnpj: "22.222.222/0001-22", tipo: TipoDestinatario.ESCOLA },
    { razao: "Creche Bem-Querer", cnpj: "33.333.333/0001-33", tipo: TipoDestinatario.CRECHE },
  ];

  for (let i = 0; i < pjDestinatarios.length; i++) {
    const pj = await prisma.pessoaJuridica.upsert({
      where: { cnpj: pjDestinatarios[i].cnpj },
      update: {},
      create: {
        razao_social: pjDestinatarios[i].razao,
        cnpj: pjDestinatarios[i].cnpj,
      },
    });

    await prisma.destinatario.upsert({
      where: { id_pessoa_juridica: pj.id_pessoa_juridica },
      update: {},
      create: {
        id_pessoa_juridica: pj.id_pessoa_juridica,
        tipo_destinatario: pjDestinatarios[i].tipo,
        id_endereco: enderecos[i].id_endereco,
      },
    });
  }
  console.log(`  ✅ ${pjDestinatarios.length} destinatários`);

  // ── Produtos ──
  const unidadeId = (await prisma.conversaoUnidade.findUnique({ where: { nome: "UNIDADE" } }))!.id_conversao;

  const produtos = ["Mesa Verde Professor", "Cadeira Verde Professor", "Giz Branco"];
  for (const nome of produtos) {
    await prisma.produto.upsert({
      where: { id_produto: produtos.indexOf(nome) + 1 },
      update: {},
      create: {
        descricao: nome,
        id_conversao_padrao: unidadeId,
      },
    });
  }
  console.log(`  ✅ ${produtos.length} produtos`);

  // ── Veículos ──
  const veiculos = [
    { descricao: "Fiorino Branco", placa: "ABC-1234", status: StatusVeiculo.DISPONIVEL, capacidade: 800 },
    { descricao: "Kombi Azul", placa: "DEF-5678", status: StatusVeiculo.INDISPONIVEL, capacidade: 1200 },
    { descricao: "SUV Preto", placa: "GHI-9012", status: StatusVeiculo.DISPONIVEL, capacidade: 500 },
  ];

  for (const v of veiculos) {
    await prisma.veiculo.upsert({
      where: { placa: v.placa },
      update: {},
      create: {
        placa: v.placa,
        modelo: v.descricao,
        capacidade: v.capacidade,
        status: v.status,
      },
    });
  }
  console.log(`  ✅ ${veiculos.length} veículos`);

  // ── Super Admin ──
  const adminFuncionario = funcionarios[0]; // João Ruan
  const senhaHash = await bcrypt.hash("admin", 10);
  await prisma.usuario.upsert({
    where: { id_funcionario: adminFuncionario.id_funcionario },
    update: {},
    create: {
      id_funcionario: adminFuncionario.id_funcionario,
      login: "admin",
      senha_hash: senhaHash,
      super_admin: true,
    },
  });
  console.log("  ✅ Super Admin (login: admin / senha: admin)");

  console.log("\n✨ Seed concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());