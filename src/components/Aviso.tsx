"use client";

export type AvisoTipo = "sucesso" | "cautela" | "erro";

interface Props {
  mensagem: string;
  tipo?: AvisoTipo;
}

const COR_BARRA: Record<AvisoTipo, string> = {
  sucesso: "bg-brand",
  cautela: "bg-warning",
  erro: "bg-danger",
};

export default function Aviso({ mensagem, tipo = "sucesso" }: Props) {
  const corBarra = COR_BARRA[tipo];

  return (
    <div
      role="alert"
      className="pointer-events-auto w-[300px] animate-[aviso-in_160ms_ease-out] overflow-hidden rounded-[10px] border border-[#5a5b5a] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
      data-figma="Aviso"
      data-figma-variant={tipo}
    >
      <div className={`flex h-[53px] items-center justify-center border-b border-[#5a5b5a] ${corBarra}`}>
        <div className="flex h-[33px] w-[210px] items-center justify-center rounded-[4px] border border-[#5a5b5a] shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
          <span className="font-sans text-2xl font-bold leading-[29px] text-white">Aviso</span>
        </div>
      </div>
      <div className="px-4 py-5 text-center font-sans text-2xl font-bold leading-[29px] text-black">
        {mensagem}
      </div>
    </div>
  );
}
