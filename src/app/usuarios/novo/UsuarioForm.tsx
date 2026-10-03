"use client";

import { useState } from "react";
import { createUsuario, updateUsuario } from "./actions";
import type { UsuarioFormData } from "./actions";
import Button from "@/components/Button";
import styles from "./UsuarioForm.module.css";

interface Funcionario {
  id_funcionario: number;
  pessoaFisica: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
  mode?: "create" | "edit" | "view";
  initialData?: UsuarioFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function UsuarioForm({
  funcionarios, mode = "create", initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [login, setLogin] = useState(initialData?.login ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [idFuncionario, setIdFuncionario] = useState(initialData?.id_funcionario ?? null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_usuario", String(initialData.id_usuario));
      const result = initialData
        ? await updateUsuario(form)
        : await createUsuario(form);
      if (result.error) setError(result.error);
      else onSuccess?.();
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <div className={styles.error}>{error}</div>}

      {isEdit && (
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Funcionário</label>
        {isView ? (
          <p className={styles.input} style={{ lineHeight: "2.5", padding: "0 0.75rem" }}>
            {initialData?.nome_funcionario ?? "—"}
          </p>
        ) : (
          <select
            className={styles.select}
            name="id_funcionario"
            required={!isView}
            value={idFuncionario ?? ""}
            onChange={(e) => setIdFuncionario(e.target.value ? Number(e.target.value) : null)}
            disabled={isView || isEdit}
          >
            <option value="">Selecione...</option>
            {funcionarios.map((f) => (
              <option key={f.id_funcionario} value={f.id_funcionario}>
                {f.pessoaFisica.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Login (e-mail)</label>
        <input
          className={styles.input}
          type="email"
          name="login"
          required={!isView}
          value={isView || isEdit ? login : undefined}
          onChange={isEdit ? (e) => setLogin(e.target.value) : undefined}
          readOnly={isView}
        />
      </div>

      <div className={styles.actions}>
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