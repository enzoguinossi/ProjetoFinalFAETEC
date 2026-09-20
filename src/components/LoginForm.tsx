"use client";

import { useState } from "react";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login:", email, senha);
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
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Senha</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <button className={styles.button} type="submit">
            Entrar
          </button>
        </div>

        {/* Versão */}
        <div className={styles.version}>V1.0.0</div>
      </form>
    </div>
  );
}