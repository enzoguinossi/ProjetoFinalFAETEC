"use client";

import { useState } from "react";
import { createFornecedor, updateFornecedor } from "./actions";
import type { FornecedorFormData } from "./actions";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FornecedorFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FornecedorForm({
  mode = "create", initialData,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_fornecedor", String(initialData.id_fornecedor));
      const result = initialData
        ? await updateFornecedor(form)
        : await createFornecedor(form);
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
          <input type="checkbox" name="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ accentColor: "#1b9956" }} />
          Ativo
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Razão Social</label>
        <input
          name="razao_social"
          required={!isView}
          defaultValue={initialData?.razao_social ?? undefined}
          readOnly={isView}
          style={{
            height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
            fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>CNPJ</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.cnpj ?? "—"}
          </p>
        ) : (
          <input
            name="cnpj"
            defaultValue={initialData?.cnpj ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Contato</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.contato ?? "—"}
          </p>
        ) : (
          <input
            name="contato"
            defaultValue={initialData?.contato ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "0.25rem 0" }} />
      <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#616161", margin: 0 }}>Endereço (opcional)</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Logradouro</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.endereco?.logradouro ?? "—"}
          </p>
        ) : (
          <input
            name="logradouro"
            defaultValue={initialData?.endereco?.logradouro ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Número</label>
          {isView ? (
            <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
              {initialData?.endereco?.numero ?? "—"}
            </p>
          ) : (
            <input
              name="numero"
              defaultValue={initialData?.endereco?.numero ?? undefined}
              readOnly={isView}
              style={{
                height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
                fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
              }}
            />
          )}
        </div>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Complemento</label>
          {isView ? (
            <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
              {initialData?.endereco?.complemento ?? "—"}
            </p>
          ) : (
            <input
              name="complemento"
              defaultValue={initialData?.endereco?.complemento ?? undefined}
              readOnly={isView}
              style={{
                height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
                fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
              }}
            />
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Bairro</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.endereco?.bairro ?? "—"}
          </p>
        ) : (
          <input
            name="bairro"
            defaultValue={initialData?.endereco?.bairro ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Cidade</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.endereco?.cidade ?? "—"}
          </p>
        ) : (
          <input
            name="cidade"
            defaultValue={initialData?.endereco?.cidade ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>CEP</label>
        {isView ? (
          <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
            {initialData?.endereco?.cep ?? "—"}
          </p>
        ) : (
          <input
            name="cep"
            defaultValue={initialData?.endereco?.cep ?? undefined}
            readOnly={isView}
            style={{
              height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Latitude</label>
          {isView ? (
            <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
              {initialData?.endereco?.latitude ?? "—"}
            </p>
          ) : (
            <input
              name="latitude"
              type="number" step="any"
              defaultValue={initialData?.endereco?.latitude ?? undefined}
              readOnly={isView}
              style={{
                height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
                fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Longitude</label>
          {isView ? (
            <p style={{ height: 40, padding: "0 16px", lineHeight: "2.5", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#21272a", margin: 0 }}>
              {initialData?.endereco?.longitude ?? "—"}
            </p>
          ) : (
            <input
              name="longitude"
              type="number" step="any"
              defaultValue={initialData?.endereco?.longitude ?? undefined}
              readOnly={isView}
              style={{
                height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
                fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none",
              }}
            />
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