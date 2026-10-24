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
  opts: { nome?: string; cpf?: string; cargo?: string; condutor?: boolean } = {},
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
    ativo?: boolean;
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
      ativo: opts.ativo ?? true,
    },
  });
}

export async function criarEstoque(
  idProduto: number,
  opts: {
    quantidadeAtual?: number;
    saldoReservado?: number;
    dataEntrada?: Date;
    ativo?: boolean;
  } = {},
) {
  return prismaTeste.estoque.create({
    data: {
      id_produto: idProduto,
      quantidade_atual: opts.quantidadeAtual ?? 0,
      saldo_reservado: opts.saldoReservado ?? 0,
      data_entrada: opts.dataEntrada ?? new Date(),
      ativo: opts.ativo ?? true,
    },
  });
}

export async function criarDestinatario(
  opts: {
    razaoSocial?: string;
    tipo?: "ESCOLA" | "CRECHE";
    ativo?: boolean;
  } = {},
) {
  const n = proximo();
  const pessoaJuridica = await prismaTeste.pessoaJuridica.create({
    data: { razao_social: opts.razaoSocial ?? `Escola ${n}` },
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
  opts: { razaoSocial?: string; comEndereco?: boolean; ativo?: boolean } = {},
) {
  const n = proximo();
  const pessoaJuridica = await prismaTeste.pessoaJuridica.create({
    data: { razao_social: opts.razaoSocial ?? `Fornecedor ${n}` },
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
  opts: { idDestinatario?: number; urgente?: boolean } = {},
) {
  return prismaTeste.notaSaida.create({
    data: {
      id_destinatario: opts.idDestinatario,
      data_criacao: new Date(),
      tipo: "SAIDA",
      status: "ABERTA",
      urgente: opts.urgente ?? false,
    },
  });
}

export async function criarItemNotaSaida(
  idNotaSaida: number,
  idEstoque: number,
  qtdEsperada = 1,
) {
  return prismaTeste.itemNotaSaida.create({
    data: { id_nota_saida: idNotaSaida, id_estoque: idEstoque, qtd_esperada: qtdEsperada },
  });
}

export async function criarExpedicao(opts: {
  idVeiculo?: number;
  idCondutor?: number;
  status?: "PLANEJADA" | "EM_PERCURSO" | "CONCLUIDA";
} = {}) {
  return prismaTeste.expedicao.create({
    data: {
      data_criacao: new Date(),
      id_veiculo: opts.idVeiculo,
      id_funcionario_condutor: opts.idCondutor,
      status: opts.status ?? "PLANEJADA",
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
  idEstoque: number,
  idUsuarioAbertura: number,
  opts: { quantidadeSistema?: number } = {},
) {
  const inventario = await prismaTeste.inventario.create({
    data: {
      data_inicio: new Date(),
      status: "ABERTO",
      id_usuario_abertura: idUsuarioAbertura,
    },
  });
  const item = await prismaTeste.itemInventario.create({
    data: {
      id_inventario: inventario.id_inventario,
      id_estoque: idEstoque,
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
  idEstoque: number,
  idUsuario: number,
  quantidade = 1,
) {
  return prismaTeste.movimentacaoEstoque.create({
    data: { id_estoque: idEstoque, id_usuario: idUsuario, quantidade, data_hora: new Date() },
  });
}

export async function criarReserva(
  idEstoque: number,
  idNotaSaida: number,
  idUsuario: number,
  quantidade = 1,
) {
  return prismaTeste.reservaEstoque.create({
    data: {
      id_estoque: idEstoque,
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
  idEstoque: number,
  idInventario: number,
  idUsuarioAprovacao?: number,
) {
  return prismaTeste.ajusteInventario.create({
    data: {
      id_estoque: idEstoque,
      id_inventario: idInventario,
      diferenca: 1,
      status: "PENDENTE",
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
