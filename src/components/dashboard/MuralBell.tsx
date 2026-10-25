"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { headerIconBtnCls } from "@/components/UserMenu";
import { contarNovasMensagens, marcarMuralVisto } from "@/app/dashboard/actions";

/**
 * Sino do mural.
 *
 * A contagem é por usuário e vive no banco (`usuario.mural_visto_em`), então
 * vários terminais veem o mesmo estado. Consulta ao montar, a cada 60 s e ao
 * voltar o foco/visibilidade — expirar ou falhar nunca derruba o header.
 */
export default function MuralBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [contador, setContador] = useState(0);

  useEffect(() => {
    let vivo = true;
    const consultar = async () => {
      try {
        const total = await contarNovasMensagens();
        if (vivo) setContador(total);
      } catch {
        // silencioso: o sino não pode quebrar o header
      }
    };

    consultar();
    const intervalo = setInterval(consultar, 60_000);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") consultar();
    };
    const aoFocar = () => consultar();
    const aoAtualizarMural = () => consultar();

    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoFocar);
    window.addEventListener("mural:atualizado", aoAtualizarMural);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoFocar);
      window.removeEventListener("mural:atualizado", aoAtualizarMural);
    };
  }, []);

  const rotulo =
    contador > 0
      ? `Mural: ${contador} mensagem(ns) nova(s)`
      : "Mural: nenhuma mensagem nova";

  async function abrirMural() {
    try {
      await marcarMuralVisto();
      setContador(0);
    } catch {
      // Mesmo sem marcar, o clique leva ao mural.
    }

    router.push("/dashboard#mural");
    router.refresh();

    if (pathname === "/dashboard") {
      window.setTimeout(() => {
        document.getElementById("mural")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    }
  }

  return (
    <button
      type="button"
      className={`${headerIconBtnCls} relative`}
      aria-label={rotulo}
      title={rotulo}
      data-figma="MuralBell"
      data-figma-bell-count={contador}
      onClick={abrirMural}
    >
      <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
      {contador > 0 && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full bg-cancel px-1 text-[0.625rem] font-semibold leading-none text-white">
          {contador > 9 ? "9+" : contador}
        </span>
      )}
    </button>
  );
}
