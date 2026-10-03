"use client";

import { useState } from "react";
import { createFuncionario, updateFuncionario } from "./actions";
import type { FuncionarioFormData } from "./actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import { TIPO_TELEFONE } from "@/types";
import Button from "@/components/Button";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FuncionarioFormData;
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

function normalizaTelefones(
  t: { numero: string; tipo: string; principal: boolean }[] | undefined,
): TelefoneEntry[] {
  return (t ?? []).map((x) => ({
    numero: x.numero,
    tipo: (TIPO_TELEFONE.includes(x.tipo as never) ? x.tipo : "CELULAR") as TelefoneEntry["tipo"],
    principal: x.principal,
  }));
}

export default function FuncionarioForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [condutor, setCondutor] = useState(initialData?.condutor ?? false);
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

  const textField = (label: string, name: string, value?: string | null, stateValue?: string, setState?: (v: string) => void, required = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={labelStyle}>{label}</label>
      {isView ? (
        <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{value ?? "—"}</p>
      ) : (
        <input
          name={name}
          required={required}
          value={isEdit ? stateValue : undefined}
          onChange={isEdit && setState ? (e) => setState(e.target.value) : undefined}
          readOnly={isView}
          style={inputStyle}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <div style={{ padding: "0.5rem 0.75rem", background: "#fff1f0", border: "1px solid #da1e28", borderRadius: 6, color: "#da1e28", fontFamily: "Inter,sans-serif", fontSize: "0.8125rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Coluna esquerda — dados */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#21272a", cursor: "pointer" }}>
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} style={{ accentColor: "#1b9956" }} />
              Ativo
            </label>
          )}

          {textField("Nome", "nome", initialData?.nome, nome, setNome, true)}
          {textField("CPF", "cpf", initialData?.cpf)}
          {textField("Cargo", "cargo", initialData?.cargo)}

          {!isView ? (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e", cursor: "pointer" }}>
              <input type="checkbox" name="condutor" checked={condutor} onChange={(e) => setCondutor(e.target.checked)} style={{ accentColor: "#1b9956", width: "1.125rem", height: "1.125rem" }} />
              É condutor
            </label>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={labelStyle}>Condutor</label>
              <p style={{ ...inputStyle, lineHeight: "2.5", margin: 0 }}>{initialData?.condutor ? "Sim" : "Não"}</p>
            </div>
          )}

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
