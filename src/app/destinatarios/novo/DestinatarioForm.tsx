"use client";

import { useState } from "react";
import { createDestinatario, updateDestinatario, buscarCep } from "./actions";
import type { DestinatarioFormData } from "./actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import EnderecoFields from "@/components/EnderecoFields";
import { TIPO_TELEFONE } from "@/types";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: DestinatarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function normalizaTelefones(
  t: { numero: string; tipo: string; principal: boolean }[] | undefined,
): TelefoneEntry[] {
  return (t ?? []).map((x) => ({
    numero: x.numero,
    tipo: (TIPO_TELEFONE.includes(x.tipo as never) ? x.tipo : "CELULAR") as TelefoneEntry["tipo"],
    principal: x.principal,
  }));
}

export default function DestinatarioForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social ?? "");
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

          <EnderecoFields
            disabled={isView}
            required
            showCoords
            onLookup={buscarCep}
            initial={initialData ? {
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