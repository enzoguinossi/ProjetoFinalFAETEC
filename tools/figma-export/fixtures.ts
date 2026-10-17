/**
 * Fixtures dedicados à exportação.
 *
 * Rodam EXCLUSIVAMENTE no banco isolado da exportação (ver `bootstrap.ts`);
 * nunca tocam o banco de desenvolvimento.
 *
 * São idempotentes: antes de inserir, apagam apenas as tabelas de cadastro que
 * eles próprios populam (na ordem correta de chaves estrangeiras). Os dados de
 * referência (permissões, perfis-template, conversões, tipos de código) vêm do
 * `prisma/seed.ts` da aplicação e são preservados.
 *
 * Uso:  npm run figma:fixtures
 */
import "./bootstrap";
import bcrypt from "bcryptjs";

import { prisma } from "../../src/lib/prisma";
import { BASE_DATABASE_URL, exportDatabaseUrl } from "./config";
import { usuarioDAO } from "../../src/dao/usuario";
import { EXPORT_DB_NAME_SHOWN } from "./bootstrap";

const SENHA_PADRAO = "nexus1234";

/** Perfis criados por este script (além dos templates do seed). */
const PERFIS_FIXTURE = ["Conferente"];

/** `--clean` apenas esvazia os cadastros, deixando o banco sem administrador. */
const APENAS_LIMPAR = process.argv.includes("--clean");

/**
 * Recusa rodar se o banco derivado para a exportação for o MESMO da aplicação.
 *
 * Os `deleteMany()` de `limpar()` apagam cadastros em massa (inclusive o
 * `registroAuditoria`), o que só é aceitável no banco isolado. Sem esta guarda,
 * um `FIGMA_EXPORT_DATABASE_URL` igual à `DATABASE_URL` apagaria os dados de
 * desenvolvimento sem aviso.
 */
function exigirBancoIsolado() {
  if (!BASE_DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida — não é possível confirmar que o banco da exportação é isolado.",
    );
  }
  const nomeBase = new URL(BASE_DATABASE_URL).pathname.replace(/^\//, "");
  const nomeExportacao = new URL(exportDatabaseUrl()).pathname.replace(/^\//, "");
  if (nomeBase === nomeExportacao) {
    throw new Error(
      `Recusando apagar dados: o banco da exportação ("${nomeExportacao}") é o MESMO ` +
        `da aplicação ("${nomeBase}"). Ajuste FIGMA_EXPORT_DATABASE_URL (derivada de ` +
        `DATABASE_URL) em tools/figma-export/.env ou na raiz.`,
    );
  }
}

async function limpar() {
  // ordem inversa das dependências
  await prisma.registroAuditoria.deleteMany();
  await prisma.usuarioPermissao.deleteMany();
  await prisma.usuario.deleteMany();

  await prisma.funcionarioCodigo.deleteMany();
  await prisma.funcionarioEmail.deleteMany();
  await prisma.funcionarioTelefone.deleteMany();
  await prisma.funcionario.deleteMany();
  await prisma.pessoaFisica.deleteMany();

  await prisma.estoque.deleteMany();
  await prisma.produtoInsumo.deleteMany();
  await prisma.produtoCodigo.deleteMany();
  await prisma.produto.deleteMany();

  await prisma.destinatarioCodigo.deleteMany();
  await prisma.destinatarioEmail.deleteMany();
  await prisma.destinatarioTelefone.deleteMany();
  await prisma.destinatario.deleteMany();

  await prisma.fornecedorCodigo.deleteMany();
  await prisma.fornecedorEmail.deleteMany();
  await prisma.fornecedorTelefone.deleteMany();
  await prisma.fornecedor.deleteMany();

  await prisma.veiculoCodigo.deleteMany();
  await prisma.veiculo.deleteMany();

  await prisma.pessoaJuridica.deleteMany();
  await prisma.endereco.deleteMany();

  await prisma.perfilPermissao.deleteMany({ where: { perfil: { nome: { in: PERFIS_FIXTURE } } } });
  await prisma.perfil.deleteMany({ where: { nome: { in: PERFIS_FIXTURE } } });
}

async function tiposCodigo() {
  const nomes = ["MATRICULA", "EAN13", "COD_ESCOLA", "COD_FORNECEDOR", "DIGITACAO"];
  const encontrados = await prisma.tipoCodigo.findMany({ where: { nome: { in: nomes } } });
  const mapa: Record<string, number> = {};
  for (const t of encontrados) mapa[t.nome] = t.id_tipo_codigo;
  const faltando = nomes.filter((n) => !mapa[n]);
  if (faltando.length > 0) {
    throw new Error(
      `Tipos de código ausentes (${faltando.join(", ")}). Rode o seed da aplicação: npm run db:seed.`,
    );
  }
  return mapa;
}

async function criarPessoaFisica(nome: string, cpf: string) {
  return prisma.pessoaFisica.create({ data: { nome, cpf } });
}

async function criarPessoaJuridica(razaoSocial: string, cnpj: string) {
  return prisma.pessoaJuridica.create({ data: { razao_social: razaoSocial, cnpj } });
}

async function criarEndereco(dados: {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}) {
  return prisma.endereco.create({ data: dados });
}

async function main() {
  exigirBancoIsolado();
  console.log(`🏗️  Fixtures de exportação — banco "${EXPORT_DB_NAME_SHOWN}"\n`);

  await limpar();

  if (APENAS_LIMPAR) {
    console.log("  🧹 Cadastros removidos. Banco sem administrador (adequado ao passo 1).\n");
    return;
  }

  const tipos = await tiposCodigo();
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  /* ── Super Admin (mesmo fluxo da aplicação, com auditoria) ── */
  const admin = await usuarioDAO.criarSuperAdmin({
    nome: "Enzo Guinossi",
    login: "admin@nexus.local",
    senha_hash: senhaHash,
  });
  console.log(`  ✅ Super Admin (login: admin@nexus.local)`);

  /* ── Perfil extra ── */
  const conferente = await prisma.perfil.create({
    data: { nome: "Conferente", descricao: "Conferência de recebimento e expedição" },
  });
  const permissoesConferente = await prisma.permissao.findMany({
    where: {
      nome: {
        in: [
          "produto.consultar",
          "estoque.ver_saldo",
          "estoque.entrada",
          "estoque.saida",
          "inventario.contar",
          "nota_entrada.consultar",
          "nota_saida.consultar",
        ],
      },
    },
  });
  for (const p of permissoesConferente) {
    await prisma.perfilPermissao.create({
      data: { id_perfil: conferente.id_perfil, id_permissao: p.id_permissao },
    });
  }

  /* ── Funcionários ── */
  const funcionarios = [
    { nome: "Ana Beatriz Souza", cpf: "39053344705", cargo: "Encarregada de Estoque", condutor: false, matricula: "100234", email: "ana.souza@nexus.local", telefone: "21987654321", login: "ana.souza@nexus.local", perfil: "Operador" },
    { nome: "Carlos Eduardo Lima", cpf: "15350946056", cargo: "Motorista", condutor: true, matricula: "100235", email: "carlos.lima@nexus.local", telefone: "21987654322", login: "carlos.lima@nexus.local", perfil: "Operador" },
    { nome: "Mariana Alves Pereira", cpf: "28461988010", cargo: "Auxiliar Administrativo", condutor: false, matricula: "100236", email: "mariana.pereira@nexus.local", telefone: "21987654323", login: "mariana.pereira@nexus.local", perfil: "Auxiliar" },
  ];

  for (const f of funcionarios) {
    const pf = await criarPessoaFisica(f.nome, f.cpf);
    const funcionario = await prisma.funcionario.create({
      data: { id_pessoa_fisica: pf.id_pessoa_fisica, cargo: f.cargo, condutor: f.condutor },
    });
    await prisma.funcionarioEmail.create({
      data: { id_funcionario: funcionario.id_funcionario, endereco: f.email, principal: true },
    });
    await prisma.funcionarioTelefone.create({
      data: {
        id_funcionario: funcionario.id_funcionario,
        numero: f.telefone,
        tipo: "CELULAR",
        principal: true,
      },
    });
    await prisma.funcionarioCodigo.create({
      data: {
        id_funcionario: funcionario.id_funcionario,
        id_tipo_codigo: tipos.MATRICULA,
        codigo: f.matricula,
      },
    });

    const usuario = await prisma.usuario.create({
      data: {
        id_funcionario: funcionario.id_funcionario,
        login: f.login,
        senha_hash: senhaHash,
        senha_alterada_em: new Date("2026-01-15T09:00:00Z"),
      },
    });

    // Aplicar um perfil substitui as permissões do usuário (não cria vínculo).
    const perfil = await prisma.perfil.findUnique({
      where: { nome: f.perfil },
      include: { permissoes: true },
    });
    if (perfil) {
      for (const pp of perfil.permissoes) {
        await prisma.usuarioPermissao.create({
          data: { id_usuario: usuario.id_usuario, id_permissao: pp.id_permissao },
        });
      }
    }
  }
  console.log(`  ✅ ${funcionarios.length} funcionários + usuários`);

  /* ── Destinatários ── */
  const destinatarios = [
    { razao: "ESCOLA MUNICIPAL CRUZEIRO DO SUL", cnpj: "45123856000174", tipo: "ESCOLA" as const, logradouro: "Rua das Acácias", numero: "120", bairro: "Centro", cidade: "Nova Iguaçu", uf: "RJ", cep: "26210040", codigo: "ESC-001", email: "cruzeiro@edu.nexus.local", telefone: "2126551001" },
    { razao: "CRECHE BEM-QUERER", cnpj: "29741890000105", tipo: "CRECHE" as const, logradouro: "Avenida Brasil", numero: "2450", bairro: "Vila Nova", cidade: "Nova Iguaçu", uf: "RJ", cep: "26215090", codigo: "CRE-001", email: "bemquerer@edu.nexus.local", telefone: "2126551002" },
    { razao: "ESCOLA MUNICIPAL MONTEIRO LOBATO", cnpj: "18340672000133", tipo: "ESCOLA" as const, logradouro: "Rua Sete de Setembro", numero: "89", bairro: "Jardim Iguaçu", cidade: "Nova Iguaçu", uf: "RJ", cep: "26220110", codigo: "ESC-002", email: "lobato@edu.nexus.local", telefone: "2126551003" },
    { razao: "CRECHE PEQUENO PRÍNCIPE", cnpj: "33882915000161", tipo: "CRECHE" as const, logradouro: "Travessa São Jorge", numero: "45", bairro: "Posse", cidade: "Nova Iguaçu", uf: "RJ", cep: "26285070", codigo: "CRE-002", email: "principe@edu.nexus.local", telefone: "2126551004" },
    { razao: "ESCOLA MUNICIPAL PAULO FREIRE", cnpj: "52280143000128", tipo: "ESCOLA" as const, logradouro: "Rua Getúlio Vargas", numero: "310", bairro: "Centro", cidade: "Belford Roxo", uf: "RJ", cep: "26113000", codigo: "ESC-003", email: "freire@edu.nexus.local", telefone: "2126551005" },
  ];

  for (const d of destinatarios) {
    const endereco = await criarEndereco({
      logradouro: d.logradouro,
      numero: d.numero,
      bairro: d.bairro,
      cidade: d.cidade,
      uf: d.uf,
      cep: d.cep,
    });
    const pj = await criarPessoaJuridica(d.razao, d.cnpj);
    const destinatario = await prisma.destinatario.create({
      data: {
        id_pessoa_juridica: pj.id_pessoa_juridica,
        id_endereco: endereco.id_endereco,
        tipo_destinatario: d.tipo,
      },
    });
    await prisma.destinatarioEmail.create({
      data: { id_destinatario: destinatario.id_destinatario, endereco: d.email, principal: true },
    });
    await prisma.destinatarioTelefone.create({
      data: {
        id_destinatario: destinatario.id_destinatario,
        numero: d.telefone,
        tipo: "COMERCIAL",
        principal: true,
      },
    });
    await prisma.destinatarioCodigo.create({
      data: {
        id_destinatario: destinatario.id_destinatario,
        id_tipo_codigo: tipos.COD_ESCOLA,
        codigo: d.codigo,
      },
    });
  }
  console.log(`  ✅ ${destinatarios.length} destinatários`);

  /* ── Fornecedores ── */
  const fornecedores = [
    { razao: "DISTRIBUIDORA ALIMENTAR RIO LTDA", cnpj: "07338231000190", contato: "Sérgio Matos", logradouro: "Rodovia Presidente Dutra", numero: "1200", bairro: "Parque Industrial", cidade: "Duque de Caxias", uf: "RJ", cep: "25085000", codigo: "FOR-001", email: "comercial@alimentarrio.com.br", telefone: "2139001200" },
    { razao: "ATACADO CENTRAL DE ALIMENTOS S.A.", cnpj: "61140298000147", contato: "Juliana Prado", logradouro: "Estrada do Porto", numero: "78", bairro: "Centro", cidade: "São Gonçalo", uf: "RJ", cep: "24420000", codigo: "FOR-002", email: "vendas@atacadocentral.com.br", telefone: "2139001201" },
    { razao: "GRÃOS E CEREAIS FLUMINENSE ME", cnpj: "24905781000106", contato: "Wagner Silva", logradouro: "Rua Projetada", numero: "15", bairro: "Boa Vista", cidade: "Niterói", uf: "RJ", cep: "24030000", codigo: "FOR-003", email: "contato@graosfluminense.com.br", telefone: "2139001202" },
  ];

  for (const f of fornecedores) {
    const endereco = await criarEndereco({
      logradouro: f.logradouro,
      numero: f.numero,
      bairro: f.bairro,
      cidade: f.cidade,
      uf: f.uf,
      cep: f.cep,
    });
    const pj = await criarPessoaJuridica(f.razao, f.cnpj);
    const fornecedor = await prisma.fornecedor.create({
      data: {
        id_pessoa_juridica: pj.id_pessoa_juridica,
        id_endereco: endereco.id_endereco,
        contato: f.contato,
      },
    });
    await prisma.fornecedorEmail.create({
      data: { id_fornecedor: fornecedor.id_fornecedor, endereco: f.email, principal: true },
    });
    await prisma.fornecedorTelefone.create({
      data: {
        id_fornecedor: fornecedor.id_fornecedor,
        numero: f.telefone,
        tipo: "COMERCIAL",
        principal: true,
      },
    });
    await prisma.fornecedorCodigo.create({
      data: {
        id_fornecedor: fornecedor.id_fornecedor,
        id_tipo_codigo: tipos.COD_FORNECEDOR,
        codigo: f.codigo,
      },
    });
  }
  console.log(`  ✅ ${fornecedores.length} fornecedores`);

  /* ── Veículos ── */
  const veiculos = [
    { placa: "RIO2A18", modelo: "Ford Cargo 1719", status: "DISPONIVEL" as const },
    { placa: "RJA4B32", modelo: "Mercedes-Benz Sprinter 416", status: "EM_ROTA" as const },
    { placa: "RJC7D45", modelo: "Volkswagen Delivery 9.170", status: "INDISPONIVEL" as const },
    { placa: "RJD1E09", modelo: "Fiat Fiorino Furgão", status: "DISPONIVEL" as const },
  ];

  for (const v of veiculos) {
    await prisma.veiculo.create({ data: v });
  }
  console.log(`  ✅ ${veiculos.length} veículos`);

  /* ── Produtos + estoque ── */
  const conversoes = await prisma.conversaoUnidade.findMany();
  const porNomeConversao: Record<string, number> = {};
  for (const c of conversoes) porNomeConversao[c.nome] = c.id_conversao;

  const produtos = [
    { descricao: "Arroz agulhinha tipo 1", codigo: "7891000315507", conversao: "CAIXA", perecivel: false, quantidade: 1240, reservado: 120, validade: null, foto: null },
    { descricao: "Feijão carioca tipo 1", codigo: "7891000247101", conversao: "PACOTE", perecivel: false, quantidade: 860, reservado: 40, validade: null, foto: null },
    { descricao: "Leite integral UHT 1L", codigo: "7891025110010", conversao: "CAIXA", perecivel: true, quantidade: 320, reservado: 180, validade: "2026-11-05", foto: "/logo.svg" },
    { descricao: "Óleo de soja 900ml", codigo: "7896036094018", conversao: "CAIXA", perecivel: false, quantidade: 210, reservado: 0, validade: null, foto: null },
    { descricao: "Macarrão espaguete 500g", codigo: "7891000053508", conversao: "PACOTE", perecivel: false, quantidade: 980, reservado: 260, validade: "2027-03-20", foto: null },
    { descricao: "Farinha de trigo 1kg", codigo: "7896006710011", conversao: "PACOTE", perecivel: false, quantidade: 145, reservado: 0, validade: "2026-12-01", foto: null },
    { descricao: "Açúcar refinado 1kg", codigo: "7891910000197", conversao: "PACOTE", perecivel: false, quantidade: 615, reservado: 95, validade: null, foto: null },
    { descricao: "Café torrado e moído 500g", codigo: "7896098900019", conversao: "UNIDADE", perecivel: false, quantidade: 430, reservado: 30, validade: "2027-01-15", foto: null },
  ];

  for (const p of produtos) {
    const produto = await prisma.produto.create({
      data: {
        descricao: p.descricao,
        foto_url: p.foto,
        perecivel: p.perecivel,
        id_conversao_padrao: porNomeConversao[p.conversao] ?? null,
        data_validade: p.validade ? new Date(p.validade) : null,
      },
    });
    await prisma.produtoCodigo.create({
      data: { id_produto: produto.id_produto, id_tipo_codigo: tipos.EAN13, codigo: p.codigo },
    });
    await prisma.estoque.create({
      data: {
        id_produto: produto.id_produto,
        quantidade_atual: p.quantidade,
        saldo_reservado: p.reservado,
        data_entrada: new Date("2026-02-10"),
      },
    });
  }
  console.log(`  ✅ ${produtos.length} produtos com estoque`);

  console.log(
    `\n✨ Fixtures aplicadas. Login disponível: ${admin.login} (senha ${SENHA_PADRAO}).`,
  );
}

main()
  .catch((erro) => {
    console.error("\n❌ Falha ao aplicar os fixtures:\n", erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
