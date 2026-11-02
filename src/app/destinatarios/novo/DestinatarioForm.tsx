"use client";

import { createDestinatario, updateDestinatario, buscarCep } from "../actions";
import type { DestinatarioFormData } from "../actions";
import EmpresaFicha, { type EmpresaFichaData } from "@/components/form/EmpresaFicha";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: DestinatarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/** Ficha do destinatário (escola/creche): delega o miolo ao `EmpresaFicha`. */
export default function DestinatarioForm({
  mode = "create",
  initialData,
  tiposCodigo,
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
        tipo_destinatario: initialData.tipo_destinatario,
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
      canDeactivate={canDeactivate}
      criar={createDestinatario}
      atualizar={updateDestinatario}
      buscarCep={buscarCep}
      onSuccess={() => onSuccess?.()}
      onCancel={onCancel}
    />
  );
}
