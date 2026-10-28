import { prismaTeste } from "./prisma";

let sequencia = 0;
const proximo = () => ++sequencia;

export async function criarTipoCodigo(nome: string, descricao?: string) {
  return prismaTeste.tipoCodigo.create({ data: { nome, descricao } });
}

export async function criarConversao(nome?: string, fator = 1) {
  const nomeFinal = nome ?? `UN${proximo()}`;
  return prismaTeste.conversaoUnidade.create({
    data: { nome: nomeFinal, fator },
  });
}

/**
 * Garante a unidade padrão do sistema (UNIDADE/1) e a devolve.
 * Todo produto precisa de uma unidade — a padrão é a escolha quando o teste
 * não informa outra.
 */
export async function garantirUnidadePadrao() {
  return prismaTeste.conversaoUnidade.upsert({
    where: { nome: "UNIDADE" },
    update: { padrao: true },
    create: {
      nome: "UNIDADE",
      fator: 1,
      descricao: "Unidade avulsa",
      padrao: true,
    },
  });
}

export async function criarUnidadePadrao() {
  return garantirUnidadePadrao();
}

export async function criarUsuario(
  opts: {
    login?: string;
    nome?: string;
    superAdmin?: boolean;
    senhaHash?: string | null;
    senhaAlteradaEm?: Date | null;
  } = {},
) {
  const n = proximo();
  const pessoaFisica = await prismaTeste.pessoaFisica.create({
    data: { nome: opts.nome ?? `Usuário ${n}` },
  });
  const funcionario = await prismaTeste.funcionario.create({
    data: { id_pessoa_fisica: pessoaFisica.id_pessoa_fisica },
  });
  const usuario = await prismaTeste.usuario.create({
    data: {
      id_funcionario: funcionario.id_funcionario,
      login: opts.login ?? `usuario${n}`,
      senha_hash: opts.senhaHash === undefined ? "hash" : opts.senhaHash,
      senha_alterada_em:
        opts.senhaAlteradaEm === undefined ? new Date(0) : opts.senhaAlteradaEm,
      super_admin: opts.superAdmin ?? false,
    },
  });
  return { usuario, funcionario, pessoaFisica };
}

export async function criarFuncionario(
  opts: {
    nome?: string;
    cpf?: string;
    cargo?: string;
    condutor?: boolean;
    ativo?: boolean;
  } = {},
) {
  const n = proximo();
  const pessoaFisica = await prismaTeste.pessoaFisica.create({
    data: { nome: opts.nome ?? `Funcionário ${n}`, cpf: opts.cpf },
  });
  const funcionario = await prismaTeste.funcionario.create({
    data: {
      id_pessoa_fisica: pessoaFisica.id_pessoa_fisica,
      cargo: opts.cargo,
      condutor: opts.condutor ?? false,
      ativo: opts.ativo ?? true,
    },
  });
  return { funcionario, pessoaFisica };
}

export async function criarProduto(
  opts: {
    descricao?: string;
    perecivel?: boolean;
    composto?: boolean;
    idConversaoPadrao?: number;
    idConversaoSaida?: number;
    ativo?: boolean;
    dataValidade?: Date;
  } = {},
) {
  const n = proximo();
  const idConversaoPadrao =
    opts.idConversaoPadrao ?? (await garantirUnidadePadrao()).id_conversao;
  return prismaTeste.produto.create({
    data: {
      descricao: opts.descricao ?? `Produto ${n}`,
      perecivel: opts.perecivel ?? false,
      composto: opts.composto ?? false,
      id_conversao_padrao: idConversaoPadrao,
      id_conversao_saida: opts.idConversaoSaida ?? idConversaoPadrao,
      ativo: opts.ativo ?? true,
      data_validade: opts.dataValidade,
    },
  });
}

export async function criarEstoque(
  idProduto: number,
  opts: {
    quantidadeAtual?: number;
    saldoReservado?: number;
  } = {},
) {
  return prismaTeste.produto.update({
    where: { id_produto: idProduto },
    data: {
      saldo: { increment: opts.quantidadeAtual ?? 0 },
      saldo_reservado: { increment: opts.saldoReservado ?? 0 },
    },
  });
}

export async function criarDestinatario(
  opts: {
    razaoSocial?: string;
    nomeFantasia?: string;
    tipo?: "ESCOLA" | "CRECHE";
    ativo?: boolean;
  } = {},
) {
  const n = proximo();
  const pessoaJuridica = await prismaTeste.pessoaJuridica.create({
    data: { razao_social: opts.razaoSocial ?? `Escola ${n}`, nome_fantasia: opts.nomeFantasia },
  });
  const endereco = await prismaTeste.endereco.create({
    data: { logradouro: `Rua ${n}`, cidade: "Rio de Janeiro" },
  });
  const destinatario = await prismaTeste.destinatario.create({
    data: {
      id_pessoa_juridica: pessoaJuridica.id_pessoa_juridica,
      id_endereco: endereco.id_endereco,
      tipo_destinatario: opts.tipo ?? "ESCOLA",
      ativo: opts.ativo ?? true,
    },
  });
  return { destinatario, pessoaJuridica, endereco };
}

export async function criarFornecedor(
  opts: { razaoSocial?: string; nomeFantasia?: string; comEndereco?: boolean; ativo?: boolean } = {},
) {
  const n = proximo();
  const pessoaJuridica = await prismaTeste.pessoaJuridica.create({
    data: { razao_social: opts.razaoSocial ?? `Fornecedor ${n}`, nome_fantasia: opts.nomeFantasia },
  });
  const endereco = opts.comEndereco
    ? await prismaTeste.endereco.create({
        data: { logradouro: `Av ${n}`, cidade: "Rio de Janeiro" },
      })
    : null;
  const fornecedor = await prismaTeste.fornecedor.create({
    data: {
      id_pessoa_juridica: pessoaJuridica.id_pessoa_juridica,
      id_endereco: endereco?.id_endereco,
      ativo: opts.ativo ?? true,
    },
  });
  return { fornecedor, pessoaJuridica, endereco };
}

export async function criarVeiculo(
  opts: {
    placa?: string;
    modelo?: string;
    status?: "DISPONIVEL" | "INDISPONIVEL" | "EM_EXPEDICAO";
    ativo?: boolean;
  } = {},
) {
  const n = proximo();
  return prismaTeste.veiculo.create({
    data: {
      placa: opts.placa ?? `ABC${1000 + n}`,
      modelo: opts.modelo,
      status: opts.status ?? "DISPONIVEL",
      ativo: opts.ativo ?? true,
    },
  });
}

export async function criarNotaSaida(
  opts: {
    idDestinatario?: number;
    urgente?: boolean;
    status?:
      | "ABERTA"
      | "EM_PERCURSO"
      | "PENDENTE"
      | "BAIXA_TOTAL"
      | "BAIXA_PARCIAL"
      | "BAIXA_COM_CORTE"
      | "CANCELADA";
    dataCriacao?: Date;
    ativo?: boolean;
  } = {},
) {
  return prismaTeste.notaSaida.create({
    data: {
      id_destinatario: opts.idDestinatario,
      data_criacao: opts.dataCriacao ?? new Date(),
      tipo: "SAIDA",
      status: opts.status ?? "ABERTA",
      urgente: opts.urgente ?? false,
      ativo: opts.ativo ?? true,
    },
  });
}

export async function criarItemNotaSaida(
  idNotaSaida: number,
  idProduto: number,
  qtdEsperada = 1,
) {
  return prismaTeste.itemNotaSaida.create({
    data: { id_nota_saida: idNotaSaida, id_produto: idProduto, qtd_esperada: qtdEsperada },
  });
}

export async function criarExpedicao(opts: {
  idVeiculo?: number;
  idCondutor?: number;
  dataPrevista?: Date;
  status?: "PLANEJADA" | "EM_PERCURSO" | "CONCLUIDA";
  ativo?: boolean;
} = {}) {
  // Veículo, condutor e data prevista são obrigatórios na expedição: a fábrica
  // cria os vínculos quando o teste não os informa.
  const idVeiculo = opts.idVeiculo ?? (await criarVeiculo()).id_veiculo;
  const idCondutor =
    opts.idCondutor ??
    (await criarFuncionario({ condutor: true })).funcionario.id_funcionario;
  return prismaTeste.expedicao.create({
    data: {
      data_criacao: new Date(),
      data_prevista:
        opts.dataPrevista ??
        new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      id_veiculo: idVeiculo,
      id_funcionario_condutor: idCondutor,
      status: opts.status ?? "PLANEJADA",
      ativo: opts.ativo ?? true,
    },
  });
}

export async function criarNotaEntrada(idFornecedor?: number) {
  return prismaTeste.notaEntrada.create({
    data: { id_fornecedor: idFornecedor, data_criacao: new Date(), tipo: "ENTRADA" },
  });
}

export async function criarPedidoEscola(idDestinatario: number) {
  return prismaTeste.pedidoEscola.create({
    data: { id_destinatario: idDestinatario, data_criacao: new Date(), status: "PENDENTE" },
  });
}

export async function criarItemPedidoEscola(
  idPedidoEscola: number,
  idProduto: number,
  quantidade = 1,
) {
  return prismaTeste.itemPedidoEscola.create({
    data: { id_pedido_escola: idPedidoEscola, id_produto: idProduto, quantidade },
  });
}

export async function criarColeta(idNotaSaida: number, idDestinatario: number) {
  return prismaTeste.coleta.create({
    data: { id_nota_saida: idNotaSaida, id_destinatario: idDestinatario, data_criacao: new Date() },
  });
}

export async function criarPercursoComDestinatario(idDestinatario: number) {
  const percurso = await prismaTeste.percurso.create({
    data: { nome: `Percurso ${proximo()}` },
  });
  await prismaTeste.percursoDestinatario.create({
    data: {
      id_percurso: percurso.id_percurso,
      id_destinatario: idDestinatario,
      ordem_visita: 1,
    },
  });
  return percurso;
}

export async function criarInventarioComItem(
  idProduto: number,
  idUsuarioAbertura: number,
  opts: { quantidadeSistema?: number } = {},
) {
  const inventario = await prismaTeste.inventario.create({
    data: {
      data_inicio: new Date(),
      status: "ABERTO",
      contagem_cega: true,
      id_usuario_abertura: idUsuarioAbertura,
    },
  });
  const item = await prismaTeste.itemInventario.create({
    data: {
      id_inventario: inventario.id_inventario,
      id_produto: idProduto,
      quantidade_sistema: opts.quantidadeSistema ?? 0,
    },
  });
  return { inventario, item };
}

export async function criarContagem(
  idItemInventario: number,
  idFuncionario: number,
  quantidadeContada = 0,
) {
  return prismaTeste.contagemInventario.create({
    data: {
      id_item_inventario: idItemInventario,
      id_funcionario: idFuncionario,
      quantidade_contada: quantidadeContada,
      data_contagem: new Date(),
    },
  });
}

export async function criarMovimentacao(
  idProduto: number,
  idUsuario: number,
  quantidade = 1,
  opts: {
    dataHora?: Date;
    saldoAnterior?: number | null;
    saldoPosterior?: number | null;
    idNotaEntrada?: number;
    idNotaSaida?: number;
    observacao?: string;
  } = {},
) {
  return prismaTeste.movimentacaoEstoque.create({
    data: {
      id_produto: idProduto,
      id_usuario: idUsuario,
      quantidade,
      data_hora: opts.dataHora ?? new Date(),
      saldo_anterior: opts.saldoAnterior,
      saldo_posterior: opts.saldoPosterior,
      id_nota_entrada: opts.idNotaEntrada,
      id_nota_saida: opts.idNotaSaida,
      observacao: opts.observacao,
    },
  });
}

export async function criarReserva(
  idProduto: number,
  idNotaSaida: number,
  idUsuario: number,
  quantidade = 1,
) {
  return prismaTeste.reservaEstoque.create({
    data: {
      id_produto: idProduto,
      id_nota_saida: idNotaSaida,
      id_usuario: idUsuario,
      quantidade,
      data_hora: new Date(),
    },
  });
}

export async function criarMensagemMural(idUsuario: number) {
  return prismaTeste.mensagemMural.create({
    data: { id_usuario: idUsuario, conteudo: "mensagem de teste", data_publicacao: new Date() },
  });
}

export async function criarAjuste(
  idProduto: number,
  idInventario: number,
  idUsuarioAprovacao?: number,
  opts: {
    quantidadeContada?: number;
    origem?: "MEDIA" | "CONTAGEM";
    idContagemInventario?: number;
    status?: "PENDENTE" | "APROVADO" | "REJEITADO";
  } = {},
) {
  return prismaTeste.ajusteInventario.create({
    data: {
      id_produto: idProduto,
      id_inventario: idInventario,
      quantidade_contada: opts.quantidadeContada ?? 1,
      origem: opts.origem ?? "MEDIA",
      id_contagem_inventario: opts.idContagemInventario,
      status: opts.status ?? "PENDENTE",
      id_usuario_aprovacao: idUsuarioAprovacao,
    },
  });
}

export async function criarPermissao(nome: string) {
  return prismaTeste.permissao.create({ data: { nome } });
}

export async function criarPerfil(nome: string, idsPermissoes: number[] = []) {
  const perfil = await prismaTeste.perfil.create({ data: { nome } });
  if (idsPermissoes.length > 0) {
    await prismaTeste.perfilPermissao.createMany({
      data: idsPermissoes.map((id_permissao) => ({
        id_perfil: perfil.id_perfil,
        id_permissao,
      })),
    });
  }
  return perfil;
}
