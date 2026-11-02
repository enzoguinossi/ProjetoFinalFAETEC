"use client";

import { createFornecedor, updateFornecedor, buscarCep } from "../actions";
import type { FornecedorFormData } from "../actions";
import EmpresaFicha, { type EmpresaFichaData } from "@/components/form/EmpresaFicha";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FornecedorFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  /** Recebe o id do fornecedor quando a criação termina com sucesso. */
  onSuccess?: (id_fornecedor?: number) => void;
  onCancel?: () => void;
}

/** Ficha do fornecedor: delega o miolo ao `EmpresaFicha`. */
export default function FornecedorForm({
  mode = "create",
  initialData,
  tiposCodigo,
  canDeactivate = true,
  onSuccess,
  onCancel,
}: Props) {
  const dados: EmpresaFichaData | undefined = initialData
    ? {
        id: initialData.id_fornecedor,
        razao_social: initialData.razao_social,
        nome_fantasia: initialData.nome_fantasia,
        cnpj: initialData.cnpj,
        ativo: initialData.ativo,
        endereco: initialData.endereco,
        codigos: initialData.codigos,
        emails: initialData.emails,
        telefones: initialData.telefones,
      }
    : undefined;

  return (
    <EmpresaFicha
      data-figma="FormularioFornecedor"
      mode={mode}
      tipo="fornecedor"
      initialData={dados}
      tiposCodigo={tiposCodigo}
      canDeactivate={canDeactivate}
      criar={createFornecedor}
      atualizar={updateFornecedor}
      buscarCep={buscarCep}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
