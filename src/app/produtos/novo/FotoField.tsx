"use client";

import { useEffect, useRef, useState } from "react";

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none transition-[border-color] duration-[120ms] w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";

export default function FotoField({ initialFotoUrl }: { initialFotoUrl?: string | null }) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [fotoNome, setFotoNome] = useState("");

  useEffect(
    () => () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    },
    [previewFoto],
  );

  function onSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewFoto(null);
      setFotoNome("");
      return;
    }
    setFotoNome(file.name);
    setPreviewFoto(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Foto</label>
      <div className="flex gap-2 items-center [&_input]:flex-1">
        <input
          className={INPUT_CLASS}
          name="foto_url"
          placeholder="URL da imagem..."
          defaultValue={initialFotoUrl ?? undefined}
        />
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          name="foto_arquivo"
          className="hidden"
          onChange={onSelecionarFoto}
        />
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 border border-border-input rounded-lg bg-white cursor-pointer text-[#697077] shrink-0 transition-[background] duration-[120ms] hover:bg-hover"
          title="Upload"
          onClick={() => fotoInputRef.current?.click()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2 2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
      </div>
      {fotoNome && (
        <span className="font-sans text-[0.8125rem] text-[#616161]">
          {fotoNome} — será convertida para WEBP ao salvar
        </span>
      )}
      {(previewFoto || initialFotoUrl) && (
        <img
          src={previewFoto ?? initialFotoUrl ?? ""}
          alt="Pré-visualização"
          className="mt-2 max-w-40 max-h-40 rounded-lg object-cover"
        />
      )}
    </div>
  );
}
