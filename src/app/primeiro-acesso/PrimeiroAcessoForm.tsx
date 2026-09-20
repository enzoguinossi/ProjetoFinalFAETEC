"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeiroAcessoAction } from "./actions";

export default function PrimeiroAcessoForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await primeiroAcessoAction(form);
      if (result.error) setError(result.error);
      else router.push("/dashboard");
    } catch {
      setError("Erro ao criar administrador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "#fff",
      borderRadius: "1.25rem",
      padding: "2rem",
      maxWidth: 420,
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <h2 style={{ margin: 0, fontFamily: "'SF Pro','Segoe UI',sans-serif", fontWeight: 590 }}>
        Criar Administrador
      </h2>
      <p style={{ margin: 0, fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "#697077" }}>
        Nenhum administrador encontrado. Crie o primeiro para começar.
      </p>

      {error && (
        <div style={{
          padding: "0.5rem 0.75rem",
          background: "#fff1f0",
          border: "1px solid #da1e28",
          borderRadius: 6,
          color: "#da1e28",
          fontFamily: "Inter,sans-serif",
          fontSize: "0.8125rem",
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>
            Nome completo
          </label>
          <input
            name="nome"
            required
            style={{
              height: "2.5rem", padding: "0 0.75rem",
              border: "1px solid #c1c7cd", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>
            Login (e-mail)
          </label>
          <input
            name="login"
            type="email"
            required
            style={{
              height: "2.5rem", padding: "0 0.75rem",
              border: "1px solid #c1c7cd", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>
            Senha
          </label>
          <input
            name="senha"
            type="password"
            required
            minLength={4}
            style={{
              height: "2.5rem", padding: "0 0.75rem",
              border: "1px solid #c1c7cd", borderRadius: 8,
              fontFamily: "Inter,sans-serif", fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.5rem 1.5rem", border: "none", borderRadius: 8,
              background: "#1b9956", color: "#fff",
              fontFamily: "Inter,sans-serif", fontSize: "0.875rem", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saving ? "Criando..." : "Criar e acessar"}
          </button>
        </div>
      </form>
    </div>
  );
}