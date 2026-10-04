"use client";

import { useState } from "react";
import { createFornecedor, updateFornecedor, buscarCep } from "./actions";
import type { FornecedorFormData } from "./actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import EnderecoFields from "@/components/EnderecoFields";
import { normalizaTelefones } from "@/lib/contatos";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FornecedorFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9", borderRadius: 8,
  fontFamily: "Inter,sans-serif", fontSize: "1rem", outline: "none", width: "100%",
  boxSizing: "border-box" as const,
};

const labelStyle = { fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" };

export default function FornecedorForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);
  const [emails, setEmails] = useState<EmailEntry[]>(initialData?.emails ?? []);
  const [telefones, setTelefones] = useState<TelefoneEntry[]>(normalizaTelefones(initialData?.telefones));

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

  const textField = (label: string, name: string, value?: string | null) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={labelStyle}>{label}</label>
      {isView ? (
        <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value ?? "—"}</p>
      ) : (
        <input name={name} defaultValue={value ?? undefined} readOnly={isView} style={inputStyle} />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <div style={{ padding: "0.5rem 0.75rem", background: "#fff1f0", border: "1px solid #da1e28", borderRadius: 6, color: "#da1e28", fontFamily: "Inter,sans-serif", fontSize: "0.8125rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "stretch" }}>
        {/* Coluna esquerda — dados, endereço e códigos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#21272a", cursor: "pointer" }}>
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} style={{ accentColor: "#1b9956" }} />
              Ativo
            </label>
          )}

          {textField("Razão Social", "razao_social", initialData?.razao_social)}
          {textField("CNPJ", "cnpj", initialData?.cnpj)}
          {textField("Contato", "contato", initialData?.contato)}

          <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "0.25rem 0" }} />
          <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#616161", margin: 0 }}>Endereço (opcional)</p>

          <EnderecoFields
            disabled={isView}
            showCoords
            onLookup={buscarCep}
            initial={initialData?.endereco ? {
              logradouro: initialData.endereco.logradouro,
              numero: initialData.endereco.numero,
              complemento: initialData.endereco.complemento,
              bairro: initialData.endereco.bairro,
              cidade: initialData.endereco.cidade,
              uf: initialData.endereco.uf,
              cep: initialData.endereco.cep,
              latitude: initialData.endereco.latitude != null ? String(initialData.endereco.latitude) : "",
              longitude: initialData.endereco.longitude != null ? String(initialData.endereco.longitude) : "",
            } : null}
          />

          <CodigosSection
            tiposCodigo={tiposCodigo}
            value={codigos}
            onChange={setCodigos}
            disabled={isView}
          />
        </div>

        {/* Coluna direita — contatos */}
        <ContatosSection
          emails={emails}
          telefones={telefones}
          onEmailsChange={setEmails}
          onTelefonesChange={setTelefones}
          disabled={isView}
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
