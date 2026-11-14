"use client";

import TiposCadastroModal, {
  type TipoCadastroItem,
} from "@/components/TiposCadastroModal";
import {
  listarTiposProduto,
  criarTipoProduto,
  atualizarTipoProduto,
  excluirTipoProduto,
} from "@/app/tipos-produto/actions";
import type { PermissoesEntidade, TipoProdutoItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: (tipos: TipoProdutoItem[]) => void;
  /** Lista inicial (vinda da página). */
  initial?: TipoProdutoItem[];
  /** Ações permitidas para o usuário (o servidor valida de novo). */
  perms?: Pick<PermissoesEntidade, "canCreate" | "canEdit" | "canDelete">;
}

function paraItem(tipo: TipoProdutoItem): TipoCadastroItem {
  return {
    id: tipo.id_tipo_produto,
    codigo: tipo.codigo,
    nome: tipo.nome,
    padrao: tipo.padrao,
    total: tipo.total_produtos,
  };
}

function paraTipo(item: TipoCadastroItem): TipoProdutoItem {
  return {
    id_tipo_produto: item.id,
    codigo: item.codigo,
    nome: item.nome,
    padrao: item.padrao,
    total_produtos: item.total,
  };
}

/** Modal do cadastro de tipos de produto (`tipo_produto`). */
export default function TiposProdutoModal({
  open,
  onClose,
  onChanged,
  initial = [],
  perms = { canCreate: false, canEdit: false, canDelete: false },
}: Props) {
  return (
    <TiposCadastroModal
      open={open}
      onClose={onClose}
      initial={initial.map(paraItem)}
      onChanged={(lista) => onChanged?.(lista.map(paraTipo))}
      perms={perms}
      titulo="Tipos de produto"
      descricaoItem="tipo de produto"
      placeholder="Merenda, Papelaria, Mobiliário..."
      rotuloTotal="Produtos"
      rotuloPadrao="Tipo padrão (aplicado automaticamente ao novo produto)"
      campoId="id_tipo_produto"
      listar={async () => (await listarTiposProduto()).map(paraItem)}
      criar={criarTipoProduto}
      atualizar={atualizarTipoProduto}
      excluir={excluirTipoProduto}
    />
  );
}
