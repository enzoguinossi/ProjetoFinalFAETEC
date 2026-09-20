"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/login/actions";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await loginAction(form);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if ("redirect" in result && result.redirect) {
      router.push(result.redirect);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        {/* Logo */}
        <div className={styles.logoArea}>
          <img src="/logo.svg" alt="Nexus" className={styles.logo} />
        </div>

        {/* Form */}
        <div className={styles.formArea}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Login</label>
            <input
              className={styles.input}
              type="text"
              name="login"
              placeholder="login"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Senha</label>
            <input
              className={styles.input}
              type="password"
              name="senha"
              placeholder="••••••••"
              required
            />
          </div>

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>

        {/* Versão */}
        <div className={styles.version}>V1.0.0</div>
      </form>
    </div>
  );
}