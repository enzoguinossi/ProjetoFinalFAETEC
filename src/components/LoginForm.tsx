"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/login/actions";
import { useAviso } from "@/components/AvisoProvider";

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const mostrarAviso = useAviso();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await loginAction(form);
    setLoading(false);

    if (result.error) {
      mostrarAviso(result.error, "erro");
    } else if ("redirect" in result && result.redirect) {
      router.push(result.redirect);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-brand">
      <form className="w-[clamp(300px,30vw,421px)] min-h-[25rem] bg-white rounded-[30px] border border-brand px-[0.6875rem] py-[0.75rem] flex flex-col gap-[2.125rem] box-border" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="flex justify-center items-center h-[7.5625rem]">
          <img src="/logo.svg" alt="Nexus" className="w-[6.875rem] h-auto" />
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col gap-[2.125rem] px-[0.625rem]">
          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-sans text-sm font-medium text-ink">Login</label>
            <input
              className="w-full h-11 px-[0.875rem] rounded-lg border border-[#c1c7cd] bg-white text-ink text-sm outline-none transition-[border-color,box-shadow] duration-150 box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.15)] placeholder:text-[#8a8f9a]"
              type="text"
              name="login"
              placeholder="login"
              required
            />
          </div>

          <div className="flex flex-col gap-[0.375rem]">
            <label className="font-sans text-sm font-medium text-ink">Senha</label>
            <input
              className="w-full h-11 px-[0.875rem] rounded-lg border border-[#c1c7cd] bg-white text-ink text-sm outline-none transition-[border-color,box-shadow] duration-150 box-border focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.15)] placeholder:text-[#8a8f9a]"
              type="password"
              name="senha"
              placeholder="••••••••"
              required
            />
          </div>

          <button className="w-full h-12 border-none rounded-lg bg-brand text-white text-base font-semibold cursor-pointer transition-[background] duration-150 hover:bg-brand-hover" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>

        {/* Versão */}
        <div className="text-center font-[family-name:monospace] text-xs text-[#8a8f9a] pb-1">{`V${process.env.NEXT_PUBLIC_APP_VERSION}`}</div>
      </form>
    </div>
  );
}
