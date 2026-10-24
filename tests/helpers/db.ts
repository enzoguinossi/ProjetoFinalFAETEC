import { prismaTeste } from "./prisma";

/**
 * Limpa todas as tabelas usando apenas a API do Prisma Client (agnóstico ao SGBD).
 * A ordem respeita as dependências de FK: filhos antes dos pais.
 */
export async function resetarBanco() {
  await prismaTeste.$transaction([
    prismaTeste.contagemInventario.deleteMany(),
    prismaTeste.itemInventario.deleteMany(),
    prismaTeste.ajusteInventario.deleteMany(),
    prismaTeste.movimentacaoEstoque.deleteMany(),
    prismaTeste.reservaEstoque.deleteMany(),
    prismaTeste.itemColeta.deleteMany(),
    prismaTeste.itemNotaSaida.deleteMany(),
    prismaTeste.itemPedidoEscola.deleteMany(),
    prismaTeste.itemNotaEntrada.deleteMany(),
    prismaTeste.percursoDestinatario.deleteMany(),
    prismaTeste.expedicaoNota.deleteMany(),
    prismaTeste.anexo.deleteMany(),
    prismaTeste.produtoCodigo.deleteMany(),
    prismaTeste.produtoInsumo.deleteMany(),
    prismaTeste.funcionarioCodigo.deleteMany(),
    prismaTeste.funcionarioTelefone.deleteMany(),
    prismaTeste.funcionarioEmail.deleteMany(),
    prismaTeste.destinatarioCodigo.deleteMany(),
    prismaTeste.destinatarioTelefone.deleteMany(),
    prismaTeste.destinatarioEmail.deleteMany(),
    prismaTeste.fornecedorCodigo.deleteMany(),
    prismaTeste.fornecedorTelefone.deleteMany(),
    prismaTeste.fornecedorEmail.deleteMany(),
    prismaTeste.veiculoCodigo.deleteMany(),
    prismaTeste.perfilPermissao.deleteMany(),
    prismaTeste.usuarioPermissao.deleteMany(),
    prismaTeste.registroAuditoria.deleteMany(),
    prismaTeste.mensagemMural.deleteMany(),
    prismaTeste.inventario.deleteMany(),
    prismaTeste.coleta.deleteMany(),
    prismaTeste.notaSaida.deleteMany(),
    prismaTeste.pedidoEscola.deleteMany(),
    prismaTeste.expedicao.deleteMany(),
    prismaTeste.percurso.deleteMany(),
    prismaTeste.notaEntrada.deleteMany(),
    prismaTeste.estoque.deleteMany(),
    prismaTeste.produto.deleteMany(),
    prismaTeste.veiculo.deleteMany(),
    prismaTeste.usuario.deleteMany(),
    prismaTeste.funcionario.deleteMany(),
    prismaTeste.destinatario.deleteMany(),
    prismaTeste.fornecedor.deleteMany(),
    prismaTeste.perfil.deleteMany(),
    prismaTeste.permissao.deleteMany(),
    prismaTeste.pessoaFisica.deleteMany(),
    prismaTeste.pessoaJuridica.deleteMany(),
    prismaTeste.endereco.deleteMany(),
    prismaTeste.conversaoUnidade.deleteMany(),
    prismaTeste.tipoCodigo.deleteMany(),
  ]);
}

/** Registros de auditoria de uma entidade, em ordem cronológica. */
export function auditoriasDe(entidade: string, idEntidade: number) {
  return prismaTeste.registroAuditoria.findMany({
    where: { entidade, id_entidade_afetada: idEntidade },
    orderBy: { id_registro_auditoria: "asc" },
  });
}
