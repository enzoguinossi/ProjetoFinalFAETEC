"use client";

import { createDestinatario, updateDestinatario, buscarCep } from "../actions";
import type { DestinatarioFormData } from "../actions";
import EmpresaFicha, { type EmpresaFichaData } from "@/components/form/EmpresaFicha";
import type { PermissoesEntidade, TipoDestinatarioItem } from "@/types";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: DestinatarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  tiposDestinatario: TipoDestinatarioItem[];
  permsTipo?: Pick<PermissoesEntidade, "canCreate" | "canEdit" | "canDelete">;
  onTiposDestinatarioChange?: (tipos: TipoDestinatarioItem[]) => void;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/** Ficha do destinatário (escola/creche): delega o miolo ao `EmpresaFicha`. */
export default function DestinatarioForm({
  mode = "create",
  initialData,
  tiposCodigo,
  tiposDestinatario,
  permsTipo,
  onTiposDestinatarioChange,
  canDeactivate = true,
  onSuccess,
  onCancel,
}: Props) {
  const dados: EmpresaFichaData | undefined = initialData
    ? {
        id: initialData.id_destinatario,
        razao_social: initialData.razao_social,
        nome_fantasia: initialData.nome_fantasia,
        cnpj: initialData.cnpj,
        ativo: initialData.ativo,
        id_tipo_destinatario: initialData.id_tipo_destinatario,
        tipo_nome: initialData.tipo_nome,
        endereco: initialData.endereco,
        codigos: initialData.codigos,
        emails: initialData.emails,
        telefones: initialData.telefones,
      }
    : undefined;

  return (
    <EmpresaFicha
      data-figma="FormularioDestinatario"
      mode={mode}
      tipo="destinatario"
      initialData={dados}
      tiposCodigo={tiposCodigo}
      tiposDestinatario={tiposDestinatario}
      permsTipo={permsTipo}
      onTiposDestinatarioChange={onTiposDestinatarioChange}
      canDeactivate={canDeactivate}
      criar={createDestinatario}
      atualizar={updateDestinatario}
      buscarCep={buscarCep}
      onSuccess={() => onSuccess?.()}
      onCancel={onCancel}
    />
  );
}
