"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeiroAcessoAction } from "./actions";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

export default function PrimeiroAcessoForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await primeiroAcessoAction(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Administrador criado com sucesso.", "sucesso");
      router.push("/dashboard");
    } catch {
      mostrarAviso("Erro ao criar administrador.", "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-[1.25rem] p-8 max-w-[420px] flex flex-col gap-4">
      <h2 className="m-0 font-display font-[590]">
        Criar Administrador
      </h2>
      <p className="m-0 font-sans text-sm text-[#697077]">
        Nenhum administrador encontrado. Crie o primeiro para começar.
      </p>

      <form onSubmit={handleSubmit} className={ui.form}>
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-sm font-medium">
            Nome completo
          </label>
          <input
            name="nome"
            required
            className="h-10 rounded-lg border border-[#c1c7cd] px-3 font-sans text-sm outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-sm font-medium">
            Login (e-mail)
          </label>
          <input
            name="login"
            type="email"
            required
            className="h-10 rounded-lg border border-[#c1c7cd] px-3 font-sans text-sm outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-sm font-medium">
            Senha
          </label>
          <input
            name="senha"
            type="password"
            required
            minLength={4}
            className="h-10 rounded-lg border border-[#c1c7cd] px-3 font-sans text-sm outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 border-0 rounded-lg bg-brand text-white font-sans text-sm font-semibold cursor-pointer"
          >
            {saving ? "Criando..." : "Criar e acessar"}
          </button>
        </div>
      </form>
    </div>
  );
}
