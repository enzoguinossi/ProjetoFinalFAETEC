"use client";

import { useState } from "react";
import { createVeiculo, updateVeiculo } from "../actions";
import type { VeiculoFormData } from "../actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: VeiculoFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function VeiculoForm({ mode = "create", initialData, tiposCodigo, canDeactivate = true, onSuccess, onCancel }: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [placa, setPlaca] = useState(initialData?.placa ?? "");
  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_veiculo", String(initialData.id_veiculo));
      const r = initialData ? await updateVeiculo(form) : await createVeiculo(form);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch { mostrarAviso("Erro ao salvar.", "erro"); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form} data-figma="FormularioVeiculo" data-figma-hug="vertical">
      {isEdit && (
        <label className="flex items-center gap-2 font-sans text-sm cursor-pointer">
          <input type="checkbox" name="ativo" defaultChecked={initialData?.ativo} disabled={!canDeactivate} className="accent-brand" /> Ativo
        </label>
      )}
      <div className={ui.field}>
        <label className={ui.label}>Placa</label>
        <input name="placa" required={!isView} value={isView || isEdit ? placa : undefined} onChange={isEdit ? e => setPlaca(e.target.value.toUpperCase()) : undefined} readOnly={isView} className={ui.input} />
      </div>
      <div className={ui.field}>
        <label className={ui.label}>Modelo</label>
        {isView ? <p className={`${ui.input} leading-[2.5] m-0`}>{initialData?.modelo ?? "—"}</p> : <input name="modelo" defaultValue={initialData?.modelo ?? undefined} readOnly={isView} className={ui.input} />}
      </div>
      <div className={ui.field}>
        <label className={ui.label}>Status</label>
        <select name="status" defaultValue={initialData?.status ?? "DISPONIVEL"} disabled={isView} className={ui.select}>
          <option value="DISPONIVEL">Disponível</option>
          <option value="INDISPONIVEL">Indisponível</option>
          <option value="EM_EXPEDICAO">Em expedição</option>
        </select>
      </div>
      <CodigosSection
        tiposCodigo={tiposCodigo}
        value={codigos}
        onChange={setCodigos}
        disabled={isView}
      />
      <div className={ui.rowActions}>
        {isView ? <Button label="Fechar" variant="cancel" onClick={onCancel} /> : <><Button label="Cancelar" variant="cancel" onClick={onCancel} /><Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} /></>}
      </div>
    </form>
  );
}
