"use client";

import { useState } from "react";
import { createVeiculo, updateVeiculo } from "./actions";
import type { VeiculoFormData } from "./actions";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: VeiculoFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function VeiculoForm({ mode = "create", initialData, onSuccess, onCancel }: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [placa, setPlaca] = useState(initialData?.placa ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError(""); setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_veiculo", String(initialData.id_veiculo));
      const r = initialData ? await updateVeiculo(form) : await createVeiculo(form);
      if (r.error) setError(r.error); else onSuccess?.();
    } catch { setError("Erro ao salvar."); } finally { setSaving(false); }
  }

  const inputStyle = { height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none", width: "100%", boxSizing: "border-box" as const };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <div style={{ padding: "0.5rem 0.75rem", background: "#fff1f0", border: "1px solid #da1e28", borderRadius: 6, color: "#da1e28", fontSize: "0.8125rem" }}>{error}</div>}
      {isEdit && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "0.875rem", cursor: "pointer" }}>
          <input type="checkbox" name="ativo" defaultChecked={initialData?.ativo} style={{ accentColor: "#1b9956" }} /> Ativo
        </label>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Placa</label>
        <input name="placa" required={!isView} value={isView || isEdit ? placa : undefined} onChange={isEdit ? e => setPlaca(e.target.value.toUpperCase()) : undefined} readOnly={isView} style={inputStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Modelo</label>
        {isView ? <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.modelo ?? "—"}</p> : <input name="modelo" defaultValue={initialData?.modelo ?? undefined} readOnly={isView} style={inputStyle} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Capacidade</label>
        {isView ? <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.capacidade ?? "—"}</p> : <input name="capacidade" type="number" defaultValue={initialData?.capacidade ?? undefined} style={inputStyle} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Status</label>
        <select name="status" defaultValue={initialData?.status ?? "DISPONIVEL"} disabled={isView} style={{ ...inputStyle, background: "#fff" }}>
          <option value="DISPONIVEL">Disponível</option>
          <option value="INDISPONIVEL">Indisponível</option>
          <option value="EM_ROTA">Em rota</option>
        </select>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        {isView ? <Button label="Fechar" variant="cancel" onClick={onCancel} /> : <><Button label="Cancelar" variant="cancel" onClick={onCancel} /><Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} /></>}
      </div>
    </form>
  );
}