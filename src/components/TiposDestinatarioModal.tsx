"use client";

import TiposCadastroModal, {
  type TipoCadastroItem,
} from "@/components/TiposCadastroModal";
import {
  listarTiposDestinatario,
  criarTipoDestinatario,
  atualizarTipoDestinatario,
  excluirTipoDestinatario,
} from "@/app/tipos-destinatario/actions";
import type { PermissoesEntidade, TipoDestinatarioItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: (tipos: TipoDestinatarioItem[]) => void;
  /** Lista inicial (vinda da página). */
  initial?: TipoDestinatarioItem[];
  /** Ações permitidas para o usuário (o servidor valida de novo). */
  perms?: Pick<PermissoesEntidade, "canCreate" | "canEdit" | "canDelete">;
}

function paraItem(tipo: TipoDestinatarioItem): TipoCadastroItem {
  return {
    id: tipo.id_tipo_destinatario,
    codigo: tipo.codigo,
    nome: tipo.nome,
    padrao: tipo.padrao,
    total: tipo.total_destinatarios,
  };
}

function paraTipo(item: TipoCadastroItem): TipoDestinatarioItem {
  return {
    id_tipo_destinatario: item.id,
    codigo: item.codigo,
    nome: item.nome,
    padrao: item.padrao,
    total_destinatarios: item.total,
  };
}

/** Modal do cadastro de tipos de escola (`tipo_destinatario`). */
export default function TiposDestinatarioModal({
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
      titulo="Tipos de escola"
      descricaoItem="tipo de escola"
      placeholder="Escola, Creche, CMEI..."
      rotuloTotal="Destinatários"
      rotuloPadrao="Tipo padrão (aplicado automaticamente ao novo destinatário)"
      campoId="id_tipo_destinatario"
      listar={async () => (await listarTiposDestinatario()).map(paraItem)}
      criar={criarTipoDestinatario}
      atualizar={atualizarTipoDestinatario}
      excluir={excluirTipoDestinatario}
    />
  );
}
