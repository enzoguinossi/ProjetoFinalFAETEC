"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { definirSenhaAction } from "./actions";
import { useAviso } from "@/components/AvisoProvider";

export default function DefinirSenhaForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await definirSenhaAction(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso("Senha definida com sucesso.", "sucesso");
      router.push("/dashboard");
    } catch {
      mostrarAviso("Erro ao definir senha.", "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-brand">
      <form className="w-[clamp(300px,30vw,421px)] min-h-[25rem] bg-white rounded-[30px] border border-brand px-[0.6875rem] py-[0.75rem] flex flex-col gap-[2.125rem] box-border" onSubmit={handleSubmit}>
        <div className="flex justify-center items-center h-[7.5625rem]">
          <img src="/logo.svg" alt="Nexus" className="w-[6.875rem] h-auto" />
        </div>
        <div className="flex-1 flex flex-col gap-4 px-[0.625rem]">
          <h2 className="font-display text-xl font-semibold text-ink m-0 text-center">Definir Senha</h2>
          <p className="font-sans text-[0.8125rem] text-[#697077] m-0 text-center">Primeiro acesso. Escolha sua senha.</p>
          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-sans text-sm font-medium text-ink">Nova senha</label>
            <input className="w-full h-11 px-[0.875rem] rounded-lg border border-[#c1c7cd] bg-white text-ink text-sm outline-none transition-[border-color,box-shadow] duration-150 box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.15)]" type="password" name="senha" required minLength={4} />
          </div>
          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-sans text-sm font-medium text-ink">Confirmar senha</label>
            <input className="w-full h-11 px-[0.875rem] rounded-lg border border-[#c1c7cd] bg-white text-ink text-sm outline-none transition-[border-color,box-shadow] duration-150 box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.15)]" type="password" name="confirmacao" required />
          </div>
          <button className="w-full h-12 border-none rounded-lg bg-brand text-white text-base font-semibold cursor-pointer transition-[background] duration-150 hover:bg-brand-hover disabled:opacity-60 disabled:cursor-default" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Definir senha e acessar"}
          </button>
        </div>
      </form>
    </div>
  );
}
