import type {
  DestinatarioRelatorioRow,
  FornecedorRelatorioRow,
  FuncionarioRelatorioRow,
  ProdutoRelatorioRow,
} from "@/dao/relatorio";
import { formatarCnpj } from "@/lib/cnpj";
import { rotuloTipoCodigo } from "@/lib/codigo";
import { formatarCpf } from "@/lib/cpf";
import { formatarQuantidade } from "@/lib/formatar";
import { formatarTelefone, TIPO_TELEFONE_LABEL } from "@/lib/telefone";
import type { TipoTelefone } from "@/types";
import type { ContatosFicha, FichaRelatorioDados } from "@/types/relatorio";

/** Rótulo do tipo de código para exibição na ficha. */
function codigosDaFicha(
  codigos: { tipo: string; codigo: string }[],
): { tipo: string; codigo: string }[] {
  return codigos.map((item) => ({
    tipo: rotuloTipoCodigo(item.tipo),
    codigo: item.codigo,
  }));
}

/** Monta a faixa de contatos: e-mails como vieram e telefones formatados. */
function contatosDaFicha(
  emails: { endereco: string; principal: boolean }[],
  telefones: { numero: string; tipo: TipoTelefone; principal: boolean }[],
): ContatosFicha {
  return {
    emails: emails.map((email) => ({
      valor: email.endereco,
      principal: email.principal,
    })),
    telefones: telefones.map((telefone) => ({
      valor: formatarTelefone(telefone.numero),
      tipo: TIPO_TELEFONE_LABEL[telefone.tipo],
      principal: telefone.principal,
    })),
  };
}

/**
 * Produto: saldos (sem unidade, como em todo o estoque), unidades de entrada e
 * saída como referência do cadastro e os códigos personalizados.
 */
export function fichaProduto(
  produto: ProdutoRelatorioRow,
  { fotos, codigos }: { fotos: boolean; codigos: boolean },
): FichaRelatorioDados {
  return {
    codigo: produto.codigo,
    titulo: produto.descricao,
    situacao: produto.situacao,
    fotoUrl: fotos ? produto.foto_url : undefined,
    linhas: [
      [
        { rotulo: "Quantidade", valor: formatarQuantidade(produto.quantidade) },
        { rotulo: "Reservado", valor: formatarQuantidade(produto.reservado) },
        { rotulo: "Qtd. livre", valor: formatarQuantidade(produto.livre) },
      ],
      [
        { rotulo: "Un. de entrada", valor: produto.unidade_entrada },
        { rotulo: "Un. de saída", valor: produto.unidade_saida },
      ],
    ],
    codigos: codigos ? codigosDaFicha(produto.codigos) : undefined,
  };
}

/** Funcionário: CPF, cargo, condutor e contato principal (ou a faixa completa). */
export function fichaFuncionario(
  funcionario: FuncionarioRelatorioRow,
  { fotos, codigos, contatos }: { fotos: boolean; codigos: boolean; contatos: boolean },
): FichaRelatorioDados {
  const identificacao = [
    { rotulo: "CPF", valor: funcionario.cpf ? formatarCpf(funcionario.cpf) : "—" },
    { rotulo: "Cargo", valor: funcionario.cargo ?? "—" },
    { rotulo: "Condutor", valor: funcionario.condutor ? "Sim" : "Não" },
  ];

  return {
    codigo: funcionario.codigo,
    titulo: funcionario.nome,
    situacao: funcionario.situacao,
    fotoUrl: fotos ? funcionario.foto_url : undefined,
    linhas: contatos
      ? [identificacao]
      : [
          identificacao,
          [
            { rotulo: "E-mail", valor: funcionario.email ?? "—" },
            { rotulo: "Telefone", valor: funcionario.telefone ?? "—" },
          ],
        ],
    codigos: codigos ? codigosDaFicha(funcionario.codigos) : undefined,
    contatos: contatos
      ? contatosDaFicha(funcionario.emails, funcionario.telefones)
      : undefined,
  };
}

/** Destinatário: CNPJ, tipo, endereço e contato. Não tem foto. */
export function fichaDestinatario(
  destinatario: DestinatarioRelatorioRow,
  { codigos, contatos }: { codigos: boolean; contatos: boolean },
): FichaRelatorioDados {
  return {
    codigo: destinatario.codigo,
    titulo: destinatario.razao_social,
    situacao: destinatario.situacao,
    linhas: contatos
      ? [
          [
            {
              rotulo: "CNPJ",
              valor: destinatario.cnpj ? formatarCnpj(destinatario.cnpj) : "—",
            },
            { rotulo: "Tipo", valor: destinatario.tipo },
          ],
          [{ rotulo: "Endereço", valor: destinatario.endereco }],
        ]
      : [
          [
            {
              rotulo: "CNPJ",
              valor: destinatario.cnpj ? formatarCnpj(destinatario.cnpj) : "—",
            },
            { rotulo: "Tipo", valor: destinatario.tipo },
            { rotulo: "Telefone", valor: destinatario.telefone ?? "—" },
          ],
          [
            { rotulo: "Endereço", valor: destinatario.endereco },
            { rotulo: "E-mail", valor: destinatario.email ?? "—" },
          ],
        ],
    codigos: codigos ? codigosDaFicha(destinatario.codigos) : undefined,
    contatos: contatos
      ? contatosDaFicha(destinatario.emails, destinatario.telefones)
      : undefined,
  };
}

/** Fornecedor: CNPJ, endereço e contato. Não tem foto. */
export function fichaFornecedor(
  fornecedor: FornecedorRelatorioRow,
  { codigos, contatos }: { codigos: boolean; contatos: boolean },
): FichaRelatorioDados {
  return {
    codigo: fornecedor.codigo,
    titulo: fornecedor.razao_social,
    situacao: fornecedor.situacao,
    linhas: contatos
      ? [
          [
            {
              rotulo: "CNPJ",
              valor: fornecedor.cnpj ? formatarCnpj(fornecedor.cnpj) : "—",
            },
            { rotulo: "Endereço", valor: fornecedor.endereco },
          ],
        ]
      : [
          [
            {
              rotulo: "CNPJ",
              valor: fornecedor.cnpj ? formatarCnpj(fornecedor.cnpj) : "—",
            },
            { rotulo: "Telefone", valor: fornecedor.telefone ?? "—" },
          ],
          [
            { rotulo: "Endereço", valor: fornecedor.endereco },
            { rotulo: "E-mail", valor: fornecedor.email ?? "—" },
          ],
        ],
    codigos: codigos ? codigosDaFicha(fornecedor.codigos) : undefined,
    contatos: contatos
      ? contatosDaFicha(fornecedor.emails, fornecedor.telefones)
      : undefined,
  };
}
