import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  DESTINATARIOS_DEMO,
  FORNECEDORES_DEMO,
  FUNCIONARIOS_DEMO,
  PRODUTOS_DEMO,
  VEICULOS_DEMO,
} from "./seed-demo-data";

/**
 * Seed de demonstração, exclusivo do banco de desenvolvimento `nexus`.
 *
 * Aditivo e idempotente: não apaga nem reseta nada; preserva o Super Admin, o
 * login e o dataset existente. Roda duas vezes sem duplicar.
 *
 * Uso: npm run db:seed:demo
 */

const BANCO_ALVO = "nexus";
const TIPOS_NECESSARIOS = [
  "MATRICULA",
  "COD_ESCOLA",
  "COD_FORNECEDOR",
  "DIGITACAO",
  "EAN12",
  "EAN13",
];

function bancoDe(url: string): { host: string; banco: string } {
  const parsed = new URL(url);
  return {
    host: `${parsed.hostname}:${parsed.port || "3306"}`,
    banco: parsed.pathname.replace(/^\//, ""),
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida. Configure o .env da raiz.");
    process.exitCode = 1;
    return;
  }

  const { host, banco } = bancoDe(url);
  console.log(`Banco alvo: ${host}/${banco}`);

  if (process.env.NODE_ENV === "production") {
    console.error("Seed de demonstração bloqueado: NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }
  if (banco === "nexus_prod") {
    console.error("Seed de demonstração bloqueado: banco de produção (nexus_prod).");
    process.exitCode = 1;
    return;
  }
  if (banco !== BANCO_ALVO) {
    console.error(
      `Seed de demonstração só roda no banco de desenvolvimento "${BANCO_ALVO}" (atual: "${banco}").`,
    );
    process.exitCode = 1;
    return;
  }

  const unidade = await prisma.conversaoUnidade.findFirst({
    where: { nome: "UNIDADE" },
    select: { id_conversao: true },
  });
  const tipos = await prisma.tipoCodigo.findMany({
    where: { nome: { in: TIPOS_NECESSARIOS } },
    select: { id_tipo_codigo: true, nome: true },
  });
  const tipoId = (nome: string): number => {
    const tipo = tipos.find((t) => t.nome === nome);
    if (!tipo) throw new Error(`Tipo de código ausente: ${nome}`);
    return tipo.id_tipo_codigo;
  };

  const tiposFaltando = TIPOS_NECESSARIOS.filter(
    (nome) => !tipos.some((t) => t.nome === nome),
  );
  if (!unidade || tiposFaltando.length > 0) {
    console.error(
      `Dados de referência ausentes${
        tiposFaltando.length > 0 ? `: ${tiposFaltando.join(", ")}` : ""
      }${!unidade ? " (unidade UNIDADE)" : ""}. Rode: npm run db:seed`,
    );
    process.exitCode = 1;
    return;
  }

  const idUnidade = unidade.id_conversao;

  /* ── Funcionários ── */
  for (const f of FUNCIONARIOS_DEMO) {
    const pessoa = await prisma.pessoaFisica.upsert({
      where: { cpf: f.cpf },
      update: { nome: f.nome, ativo: true },
      create: { nome: f.nome, cpf: f.cpf, ativo: true },
    });
    const funcionario = await prisma.funcionario.upsert({
      where: { id_pessoa_fisica: pessoa.id_pessoa_fisica },
      update: { cargo: f.cargo, condutor: f.condutor, ativo: true },
      create: {
        id_pessoa_fisica: pessoa.id_pessoa_fisica,
        cargo: f.cargo,
        condutor: f.condutor,
        ativo: true,
      },
    });
    await prisma.funcionarioEmail.upsert({
      where: { endereco: f.email },
      update: { principal: true },
      create: {
        id_funcionario: funcionario.id_funcionario,
        endereco: f.email,
        principal: true,
      },
    });
    await prisma.funcionarioTelefone.upsert({
      where: { numero: f.telefone },
      update: { tipo: "CELULAR", principal: true, ativo: true },
      create: {
        id_funcionario: funcionario.id_funcionario,
        numero: f.telefone,
        tipo: "CELULAR",
        principal: true,
        ativo: true,
      },
    });
    await prisma.funcionarioCodigo.upsert({
      where: { codigo: f.matricula },
      update: {
        id_funcionario: funcionario.id_funcionario,
        id_tipo_codigo: tipoId("MATRICULA"),
      },
      create: {
        id_funcionario: funcionario.id_funcionario,
        id_tipo_codigo: tipoId("MATRICULA"),
        codigo: f.matricula,
      },
    });
  }

  /* ── Destinatários (escolas e creches) ── */
  for (const d of DESTINATARIOS_DEMO) {
    const pessoa = await prisma.pessoaJuridica.upsert({
      where: { cnpj: d.cnpj },
      update: { razao_social: d.razaoSocial, ativo: true },
      create: { razao_social: d.razaoSocial, cnpj: d.cnpj, ativo: true },
    });
    const endereco = {
      logradouro: d.logradouro,
      numero: d.numero,
      bairro: d.bairro,
      cidade: d.cidade,
      uf: d.uf,
      cep: d.cep,
    };
    const existente = await prisma.destinatario.findUnique({
      where: { id_pessoa_juridica: pessoa.id_pessoa_juridica },
      select: { id_destinatario: true, id_endereco: true },
    });

    let destinatario;
    if (existente) {
      await prisma.endereco.update({
        where: { id_endereco: existente.id_endereco },
        data: endereco,
      });
      destinatario = await prisma.destinatario.update({
        where: { id_destinatario: existente.id_destinatario },
        data: { tipo_destinatario: d.tipo, ativo: true },
      });
    } else {
      const novoEndereco = await prisma.endereco.create({ data: endereco });
      destinatario = await prisma.destinatario.create({
        data: {
          id_pessoa_juridica: pessoa.id_pessoa_juridica,
          id_endereco: novoEndereco.id_endereco,
          tipo_destinatario: d.tipo,
          ativo: true,
        },
      });
    }

    await prisma.destinatarioEmail.upsert({
      where: { endereco: d.email },
      update: { principal: true },
      create: {
        id_destinatario: destinatario.id_destinatario,
        endereco: d.email,
        principal: true,
      },
    });
    await prisma.destinatarioTelefone.upsert({
      where: { numero: d.telefone },
      update: { tipo: "COMERCIAL", principal: true, ativo: true },
      create: {
        id_destinatario: destinatario.id_destinatario,
        numero: d.telefone,
        tipo: "COMERCIAL",
        principal: true,
        ativo: true,
      },
    });
    await prisma.destinatarioCodigo.upsert({
      where: { codigo: d.codigo },
      update: {
        id_destinatario: destinatario.id_destinatario,
        id_tipo_codigo: tipoId("COD_ESCOLA"),
      },
      create: {
        id_destinatario: destinatario.id_destinatario,
        id_tipo_codigo: tipoId("COD_ESCOLA"),
        codigo: d.codigo,
      },
    });
  }

  /* ── Fornecedores ── */
  for (const f of FORNECEDORES_DEMO) {
    const pessoa = await prisma.pessoaJuridica.upsert({
      where: { cnpj: f.cnpj },
      update: { razao_social: f.nome, ativo: true },
      create: { razao_social: f.nome, cnpj: f.cnpj, ativo: true },
    });
    const endereco = {
      logradouro: f.logradouro,
      numero: f.numero,
      bairro: f.bairro,
      cidade: f.cidade,
      uf: f.uf,
      cep: f.cep,
    };
    const existente = await prisma.fornecedor.findUnique({
      where: { id_pessoa_juridica: pessoa.id_pessoa_juridica },
      select: { id_fornecedor: true, id_endereco: true },
    });

    let fornecedor;
    if (existente) {
      if (existente.id_endereco) {
        await prisma.endereco.update({
          where: { id_endereco: existente.id_endereco },
          data: endereco,
        });
        fornecedor = await prisma.fornecedor.update({
          where: { id_fornecedor: existente.id_fornecedor },
          data: { ativo: true },
        });
      } else {
        const novoEndereco = await prisma.endereco.create({ data: endereco });
        fornecedor = await prisma.fornecedor.update({
          where: { id_fornecedor: existente.id_fornecedor },
          data: { id_endereco: novoEndereco.id_endereco, ativo: true },
        });
      }
    } else {
      const novoEndereco = await prisma.endereco.create({ data: endereco });
      fornecedor = await prisma.fornecedor.create({
        data: {
          id_pessoa_juridica: pessoa.id_pessoa_juridica,
          id_endereco: novoEndereco.id_endereco,
          ativo: true,
        },
      });
    }

    await prisma.fornecedorEmail.upsert({
      where: { endereco: f.email },
      update: { principal: true },
      create: {
        id_fornecedor: fornecedor.id_fornecedor,
        endereco: f.email,
        principal: true,
      },
    });
    await prisma.fornecedorTelefone.upsert({
      where: { numero: f.telefone },
      update: { tipo: "COMERCIAL", principal: true, ativo: true },
      create: {
        id_fornecedor: fornecedor.id_fornecedor,
        numero: f.telefone,
        tipo: "COMERCIAL",
        principal: true,
        ativo: true,
      },
    });
    await prisma.fornecedorCodigo.upsert({
      where: { codigo: f.codigo },
      update: {
        id_fornecedor: fornecedor.id_fornecedor,
        id_tipo_codigo: tipoId("COD_FORNECEDOR"),
      },
      create: {
        id_fornecedor: fornecedor.id_fornecedor,
        id_tipo_codigo: tipoId("COD_FORNECEDOR"),
        codigo: f.codigo,
      },
    });
  }

  /* ── Veículos ── */
  for (const v of VEICULOS_DEMO) {
    const veiculo = await prisma.veiculo.upsert({
      where: { placa: v.placa },
      update: { modelo: v.modelo, status: v.status, ativo: true },
      create: { placa: v.placa, modelo: v.modelo, status: v.status, ativo: true },
    });
    await prisma.veiculoCodigo.upsert({
      where: { codigo: v.codigo },
      update: {
        id_veiculo: veiculo.id_veiculo,
        id_tipo_codigo: tipoId("DIGITACAO"),
      },
      create: {
        id_veiculo: veiculo.id_veiculo,
        id_tipo_codigo: tipoId("DIGITACAO"),
        codigo: v.codigo,
      },
    });
  }

  /* ── Produtos (saldo direto, sem movimento) ── */
  for (const p of PRODUTOS_DEMO) {
    const dados = {
      descricao: p.descricao,
      perecivel: p.perecivel,
      composto: false,
      data_validade: p.validade ? new Date(`${p.validade}T00:00:00.000Z`) : null,
      id_conversao_padrao: idUnidade,
      id_conversao_saida: idUnidade,
      saldo: p.saldo,
      saldo_reservado: 0,
      ativo: true,
    };
    const codigoExistente = await prisma.produtoCodigo.findUnique({
      where: { codigo: p.ean },
      select: { id_produto: true },
    });
    const produto = codigoExistente
      ? await prisma.produto.update({
          where: { id_produto: codigoExistente.id_produto },
          data: dados,
        })
      : await prisma.produto.create({ data: dados });

    await prisma.produtoCodigo.upsert({
      where: { codigo: p.ean },
      update: {
        id_produto: produto.id_produto,
        id_tipo_codigo: tipoId(p.tipo),
      },
      create: {
        id_produto: produto.id_produto,
        id_tipo_codigo: tipoId(p.tipo),
        codigo: p.ean,
      },
    });
  }

  const resumo = await Promise.all([
    prisma.funcionario.count(),
    prisma.destinatario.count(),
    prisma.fornecedor.count(),
    prisma.veiculo.count(),
    prisma.produto.count(),
  ]);

  console.log(
    [
      "Seed demo aplicado (aditivo).",
      `Funcionários: ${resumo[0]} (demo: ${FUNCIONARIOS_DEMO.length})`,
      `Destinatários: ${resumo[1]} (demo: ${DESTINATARIOS_DEMO.length})`,
      `Fornecedores: ${resumo[2]} (demo: ${FORNECEDORES_DEMO.length})`,
      `Veículos: ${resumo[3]} (demo: ${VEICULOS_DEMO.length})`,
      `Produtos: ${resumo[4]} (demo: ${PRODUTOS_DEMO.length})`,
    ].join("\n"),
  );
}

main()
  .catch((erro) => {
    console.error("Falha no seed demo:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
