"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { definirSenhaAction } from "./actions";
import styles from "./DefinirSenha.module.css";

export default function DefinirSenhaForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await definirSenhaAction(form);
      if (result.error) setError(result.error);
      else router.push("/dashboard");
    } catch {
      setError("Erro ao definir senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logoArea}>
          <img src="/logo.svg" alt="Nexus" className={styles.logo} />
        </div>
        <div className={styles.formArea}>
          <h2 className={styles.title}>Definir Senha</h2>
          <p className={styles.subtitle}>Primeiro acesso. Escolha sua senha.</p>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Nova senha</label>
            <input className={styles.input} type="password" name="senha" required minLength={4} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Confirmar senha</label>
            <input className={styles.input} type="password" name="confirmacao" required />
          </div>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Definir senha e acessar"}
          </button>
        </div>
      </form>
    </div>
  );
}