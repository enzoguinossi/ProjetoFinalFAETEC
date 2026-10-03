"use client";

import { useState } from "react";
import { createFuncionario, updateFuncionario } from "./actions";
import type { FuncionarioFormData } from "./actions";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FuncionarioFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FuncionarioForm({
  mode = "create", initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [condutor, setCondutor] = useState(initialData?.condutor ?? false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_funcionario", String(initialData.id_funcionario));
      const result = initialData
        ? await updateFuncionario(form)
        : await createFuncionario(form);
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

      {isEdit && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#21272a", cursor: "pointer" }}>
          <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} style={{ accentColor: "#1b9956" }} />
          Ativo
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Nome</label>
        <input
          name="nome"
          required={!isView}
          value={isView || isEdit ? nome : undefined}
          onChange={isEdit ? (e) => setNome(e.target.value) : undefined}
          readOnly={isView}
          style={{
            height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
            fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>CPF</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.cpf ?? "—"}
          </p>
        ) : (
          <input
            name="cpf"
            defaultValue={initialData?.cpf ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Cargo</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.cargo ?? "—"}
          </p>
        ) : (
          <input
            name="cargo"
            defaultValue={initialData?.cargo ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      {!isView && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e", cursor: "pointer" }}>
          <input type="checkbox" name="condutor" checked={condutor} onChange={(e) => setCondutor(e.target.checked)} style={{ accentColor: "#1b9956", width: "1.125rem", height: "1.125rem" }} />
          É condutor
        </label>
      )}

      {isView && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Condutor</label>
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.condutor ? "Sim" : "Não"}
          </p>
        </div>
      )}

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