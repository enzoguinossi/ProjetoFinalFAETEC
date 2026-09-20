"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUsuario } from "./actions";
import styles from "./UsuarioForm.module.css";

interface Funcionario {
  id_funcionario: number;
  pessoaFisica: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export default function UsuarioForm({ funcionarios }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await createUsuario(form);
      if (result.error) setError(result.error);
      else router.push("/usuarios");
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.field}>
        <label className={styles.label}>Funcionário</label>
        <select className={styles.select} name="id_funcionario" required>
          <option value="">Selecione...</option>
          {funcionarios.map((f) => (
            <option key={f.id_funcionario} value={f.id_funcionario}>
              {f.pessoaFisica.nome}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Login (e-mail)</label>
        <input className={styles.input} type="email" name="login" required />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => router.back()}>
          Cancelar
        </button>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}