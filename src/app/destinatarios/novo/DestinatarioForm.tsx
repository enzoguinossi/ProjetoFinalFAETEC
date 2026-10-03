"use client";

import { useState } from "react";
import { createDestinatario, updateDestinatario } from "./actions";
import type { DestinatarioFormData } from "./actions";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: DestinatarioFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function DestinatarioForm({
  mode = "create", initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_destinatario", String(initialData.id_destinatario));
      const result = initialData
        ? await updateDestinatario(form)
        : await createDestinatario(form);
      if (result.error) setError(result.error);
      else onSuccess?.();
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none", width: "100%", boxSizing: "border-box" as const };

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
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Razão Social</label>
        <input
          name="razao_social"
          required={!isView}
          value={isView || isEdit ? razaoSocial : undefined}
          onChange={isEdit ? (e) => setRazaoSocial(e.target.value) : undefined}
          readOnly={isView}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>CNPJ</label>
        {isView ? (
          <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.cnpj ?? "—"}</p>
        ) : (
          <input name="cnpj" defaultValue={initialData?.cnpj ?? undefined} style={inputStyle} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Tipo</label>
        <select name="tipo_destinatario" defaultValue={initialData?.tipo_destinatario ?? "ESCOLA"} disabled={isView} style={{ ...inputStyle, background: "#fff" }}>
          <option value="ESCOLA">Escola</option>
          <option value="CRECHE">Creche</option>
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Logradouro</label>
        {isView ? (
          <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.logradouro ?? "—"}</p>
        ) : (
          <input name="logradouro" required defaultValue={initialData?.endereco.logradouro ?? undefined} style={inputStyle} />
        )}
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Número</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.numero ?? "—"}</p>
          ) : (
            <input name="numero" defaultValue={initialData?.endereco.numero ?? undefined} style={inputStyle} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Complemento</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.complemento ?? "—"}</p>
          ) : (
            <input name="complemento" defaultValue={initialData?.endereco.complemento ?? undefined} style={inputStyle} />
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Bairro</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.bairro ?? "—"}</p>
          ) : (
            <input name="bairro" defaultValue={initialData?.endereco.bairro ?? undefined} style={inputStyle} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Cidade</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.cidade ?? "—"}</p>
          ) : (
            <input name="cidade" required={!isView} defaultValue={initialData?.endereco.cidade ?? undefined} style={inputStyle} />
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>CEP</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.cep ?? "—"}</p>
          ) : (
            <input name="cep" defaultValue={initialData?.endereco.cep ?? undefined} style={inputStyle} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Latitude</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.latitude ?? "—"}</p>
          ) : (
            <input name="latitude" type="number" step="any" defaultValue={initialData?.endereco.latitude ?? undefined} style={inputStyle} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Longitude</label>
          {isView ? (
            <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.endereco.longitude ?? "—"}</p>
          ) : (
            <input name="longitude" type="number" step="any" defaultValue={initialData?.endereco.longitude ?? undefined} style={inputStyle} />
          )}
        </div>
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