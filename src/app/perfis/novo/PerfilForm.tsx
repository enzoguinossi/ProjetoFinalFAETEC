"use client";

import { useState } from "react";
import { createPerfil, updatePerfil } from "../actions";
import type { PerfilFormData } from "../actions";
import Button from "@/components/Button";
import PermissoesPanel, { type GrupoPermissoes } from "@/components/PermissoesPanel";

interface Props {
  grupos: GrupoPermissoes[];
  mode?: "create" | "edit" | "view";
  initialData?: PerfilFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
  borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
  outline: "none", width: "100%", boxSizing: "border-box" as const,
};

export default function PerfilForm({
  grupos, mode = "create", initialData, onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [selecionadas, setSelecionadas] = useState<string[]>(initialData?.permissoes ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      form.set("permissoes", JSON.stringify(selecionadas));
      if (initialData) form.set("id_perfil", String(initialData.id_perfil));
      const result = initialData ? await updatePerfil(form) : await createPerfil(form);
      if (result.error) setError(result.error);
      else onSuccess?.();
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <div style={{ padding: "0.5rem 0.75rem", background: "#fff1f0", border: "1px solid #da1e28", borderRadius: 6, color: "#da1e28", fontFamily: "Inter,sans-serif", fontSize: "0.8125rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Nome</label>
            <input name="nome" required={!isView} value={isView || isEdit ? nome : undefined}
              onChange={isEdit ? (e) => setNome(e.target.value) : undefined} readOnly={isView} style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Descrição</label>
            {isView ? (
              <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.descricao ?? "—"}</p>
            ) : (
              <input
                name="descricao"
                value={isEdit ? descricao : undefined}
                defaultValue={isEdit ? undefined : (initialData?.descricao ?? undefined)}
                onChange={isEdit ? (e) => setDescricao(e.target.value) : undefined}
                style={inputStyle}
              />
            )}
          </div>
        </div>

        <PermissoesPanel
          grupos={grupos}
          selecionadas={selecionadas}
          onChange={setSelecionadas}
          disabled={isView}
          tituloSelecionadas="Do perfil"
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
          </>
        )}
      </div>
    </form>
  );
}
