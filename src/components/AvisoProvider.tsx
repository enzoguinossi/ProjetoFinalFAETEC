"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Aviso, { type AvisoTipo } from "@/components/Aviso";

type MostrarAviso = (mensagem: string, tipo?: AvisoTipo) => void;

const AvisoContext = createContext<MostrarAviso>(() => {});

export function useAviso(): MostrarAviso {
  return useContext(AvisoContext);
}

export default function AvisoProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<{ id: number; mensagem: string; tipo: AvisoTipo }[]>([]);
  const idRef = useRef(0);

  const mostrarAviso = useCallback<MostrarAviso>((mensagem, tipo = "sucesso") => {
    const id = idRef.current++;
    setAvisos((atual) => [...atual, { id, mensagem, tipo }]);
    setTimeout(() => {
      setAvisos((atual) => atual.filter((a) => a.id !== id));
    }, 5000);
  }, []);

  return (
    <AvisoContext.Provider value={mostrarAviso}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[2000] flex w-[300px] -translate-x-1/2 flex-col gap-3">
        {avisos.map((a) => (
          <Aviso key={a.id} mensagem={a.mensagem} tipo={a.tipo} />
        ))}
      </div>
    </AvisoContext.Provider>
  );
}
