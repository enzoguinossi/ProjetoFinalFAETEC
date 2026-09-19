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
        <div className={styles.header}>
          <div className={styles.logo}>NEXUS</div>
          <div className={styles.logoSub}>SISTEMA LOGÍSTICO</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>E-mail</label>
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
          Acessar
        </button>

        <div className={styles.forgot}>
          <a href="#">Esqueceu a senha?</a>
        </div>
      </form>
    </div>
  );
}