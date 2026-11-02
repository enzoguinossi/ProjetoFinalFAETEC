"use client";

import { useEffect, useRef, useState } from "react";

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none transition-[border-color] duration-[120ms] w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";

/** Limite por arquivo; o servidor reforça em `processarImagemWebp`. */
const MAX_BYTES_POR_FOTO = 5 * 1024 * 1024;

export type FotoExistente = { id_anexo: number; url: string };

type ArquivoNovo = {
  chave: number;
  file: File;
  preview: string;
};

interface Props {
  /** Anexos já gravados (1 no cadastro, N na tentativa). */
  initial: FotoExistente[];
  /** Máximo de fotos: 1 no cadastro, 5 na tentativa. */
  max: number;
  /** Upload por URL só no cadastro. */
  allowUrl?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  label?: string;
  /** Nome do input de arquivo (padrão `foto_arquivo`). */
  name?: string;
  /** Nome do input de URL (padrão `foto_url`). */
  urlName?: string;
  /**
   * `identity` = preview compacto para a faixa de identidade do produto
   * (foto de ~72px, “Trocar”/“Remover” e URL revelada por “Usar URL”).
   * O padrão continua sendo o usado por funcionário e tentativa de entrega.
   */
  variant?: "default" | "identity";
}

/**
 * Componente único de fotos. Mostra/anexa arquivos, aceita URL externa no
 * cadastro e permite remover fotos existentes (via `remover_anexos`) ou novos
 * arquivos antes de enviar. O processamento (WEBP/limite) é do servidor.
 */
export default function FotosField({
  initial,
  max,
  allowUrl = false,
  readOnly = false,
  disabled = false,
  label = "Foto",
  name = "foto_arquivo",
  urlName = "foto_url",
  variant = "default",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [existentes] = useState<FotoExistente[]>(initial);
  const [removidos, setRemovidos] = useState<number[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoNovo[]>([]);
  const [aviso, setAviso] = useState("");
  const [mostrarUrl, setMostrarUrl] = useState(false);
  const proximoId = useRef(1);
  const previews = useRef<Set<string>>(new Set());

  // Revoga só no unmount; as URLs vivas não podem ser revogadas a cada mudança
  // de `arquivos` (a imagem que continua na lista perde o preview).
  useEffect(
    () => () => {
      for (const preview of previews.current) URL.revokeObjectURL(preview);
      previews.current.clear();
    },
    [],
  );

  // O input de arquivo é limpo após cada seleção, então o FormData nativo
  // perderia os arquivos já escolhidos. Mantém `input.files` sincronizado com o
  // estado (inclui a remoção de um arquivo antes de enviar).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const transferencia = new DataTransfer();
    for (const arquivo of arquivos) transferencia.items.add(arquivo.file);
    input.files = transferencia.files;
  }, [arquivos]);

  // Com `max = 1`, escolher um novo arquivo substitui a foto atual: o servidor
  // desativa o anexo anterior ao salvar, então não marcamos `remover_anexos`.
  const substituindo = max === 1 && arquivos.length > 0;
  const visiveis = existentes.filter(
    (foto) => !removidos.includes(foto.id_anexo) && !substituindo,
  );
  const total = visiveis.length + arquivos.length;

  function adicionarPreview(file: File): ArquivoNovo {
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    return { chave: proximoId.current++, file, preview };
  }

  function selecionarArquivos(event: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(event.target.files ?? []);
    if (escolhidos.length === 0) return;

    const grandes = escolhidos.filter((file) => file.size > MAX_BYTES_POR_FOTO);
    const aceitosPorTamanho = escolhidos.filter(
      (file) => file.size <= MAX_BYTES_POR_FOTO,
    );
    const avisoTamanho =
      grandes.length > 0
        ? `Imagem acima de 5 MB: ${grandes.map((file) => file.name).join(", ")}.`
        : "";

    if (aceitosPorTamanho.length === 0) {
      setAviso(avisoTamanho || "Nenhuma imagem válida selecionada.");
      event.target.value = "";
      return;
    }

    if (max === 1) {
      for (const atual of arquivos) {
        URL.revokeObjectURL(atual.preview);
        previews.current.delete(atual.preview);
      }
      setArquivos([adicionarPreview(aceitosPorTamanho[0]!)]);
      setAviso(avisoTamanho);
      event.target.value = "";
      return;
    }

    const espaco = Math.max(0, max - total);
    if (espaco === 0) {
      setAviso(`Limite de ${max} fotos atingido.`);
      event.target.value = "";
      return;
    }

    const aceitos = aceitosPorTamanho.slice(0, espaco);
    if (escolhidos.length > espaco) {
      setAviso(
        [avisoTamanho, `Só é possível anexar ${espaco} foto${espaco === 1 ? "" : "s"} agora.`]
          .filter(Boolean)
          .join(" "),
      );
    } else {
      setAviso(avisoTamanho);
    }

    const novos = aceitos.map(adicionarPreview);
    setArquivos((atuais) => [...atuais, ...novos]);
    event.target.value = "";
  }

  function removerArquivo(chave: number) {
    setArquivos((atuais) => {
      const alvo = atuais.find((arquivo) => arquivo.chave === chave);
      if (alvo) {
        URL.revokeObjectURL(alvo.preview);
        previews.current.delete(alvo.preview);
      }
      return atuais.filter((arquivo) => arquivo.chave !== chave);
    });
  }

  function alternarExistente(idAnexo: number) {
    setRemovidos((atuais) =>
      atuais.includes(idAnexo)
        ? atuais.filter((id) => id !== idAnexo)
        : [...atuais, idAnexo],
    );
  }

  const fotoNova = arquivos[0];
  const fotoExistente = visiveis[0];
  const previewAtual = fotoNova?.preview ?? fotoExistente?.url ?? null;

  function removerAtual() {
    if (fotoNova) {
      removerArquivo(fotoNova.chave);
      return;
    }
    if (fotoExistente) alternarExistente(fotoExistente.id_anexo);
  }

  if (variant === "identity") {
    return (
      <div className="flex flex-col gap-2">
        <input type="hidden" name="remover_anexos" value={removidos.join(",")} />

        <div className="flex items-start gap-3">
          {previewAtual ? (
            <a
              href={fotoExistente?.url ?? fotoNova?.preview}
              target="_blank"
              rel="noreferrer"
              title="Ver foto"
              className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white"
            >
              <img
                src={previewAtual}
                alt={label}
                className="h-full w-full object-cover"
              />
            </a>
          ) : (
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#c1c7cd] bg-white text-[#8a8f9a]"
              aria-hidden="true"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m21 15-4.5-4.5L7 20" />
              </svg>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              name={name}
              multiple={max > 1}
              className="hidden"
              onChange={selecionarArquivos}
              aria-label={`Selecionar ${label.toLowerCase()}`}
            />

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex h-8 items-center rounded-md border border-border bg-white px-2.5 font-sans text-xs font-semibold text-ink transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40"
                >
                  {previewAtual ? "Trocar" : "Adicionar foto"}
                </button>
                {previewAtual && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={removerAtual}
                    className="inline-flex h-8 items-center rounded-md px-2 font-sans text-xs font-semibold text-[#b42318] transition-colors hover:bg-[#fff1f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40"
                  >
                    Remover
                  </button>
                )}
                {allowUrl && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setMostrarUrl((atual) => !atual)}
                    aria-expanded={mostrarUrl}
                    className="inline-flex h-8 items-center rounded-md px-2 font-sans text-xs font-semibold text-brand transition-colors hover:bg-[rgba(27,153,86,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40"
                  >
                    {mostrarUrl ? "Ocultar URL" : "Usar URL"}
                  </button>
                )}
              </div>
            )}

            <span className="font-sans text-xs text-[#697077]">
              JPG, PNG ou WEBP até 5 MB.
            </span>

            {allowUrl && !readOnly && (
              <div className={mostrarUrl ? "block" : "hidden"}>
                <input
                  className="h-8 w-full rounded-md border border-border-input bg-white px-2 font-sans text-xs text-ink outline-none transition-[border-color] duration-150 focus:border-brand"
                  name={urlName}
                  placeholder="URL da imagem (opcional)"
                  disabled={disabled}
                />
              </div>
            )}

            {aviso && (
              <span className="font-sans text-xs text-[#8a5a00]">{aviso}</span>
            )}
            {disabled && !readOnly && (
              <span className="font-sans text-xs text-[#8a5a00]">
                Sem permissão para alterar a foto.
              </span>
            )}
            {removidos.length > 0 && (
              <span className="font-sans text-xs text-[#8a5a00]">
                Foto marcada para remoção ao salvar.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">
        {label}
      </label>

      <input type="hidden" name="remover_anexos" value={removidos.join(",")} />

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {allowUrl && (
            <input
              className={INPUT_CLASS}
              name={urlName}
              placeholder="URL da imagem (opcional)"
              disabled={disabled}
            />
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            name={name}
            multiple={max > 1}
            className="hidden"
            onChange={selecionarArquivos}
            aria-label={`Selecionar ${label.toLowerCase()}`}
          />
          <button
            type="button"
            disabled={disabled || (max > 1 && total >= max)}
            onClick={() => inputRef.current?.click()}
            title="Anexar imagem"
            aria-label="Anexar imagem"
            className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-[#4a4f55] transition-colors hover:bg-[#f2f4f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4m0 0-4 4m4-4 4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Anexar
          </button>
        </div>
      )}

      <span className="font-sans text-xs text-[#697077]">
        JPG, PNG ou WEBP até 5 MB. {max > 1 ? `Até ${max} fotos.` : "Uma foto por cadastro."}
      </span>

      {(aviso || (disabled && !readOnly)) && (
        <span className="font-sans text-xs text-[#8a5a00]">
          {aviso || "Sem permissão para alterar a foto."}
        </span>
      )}

      {(visiveis.length > 0 || arquivos.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-3">
          {visiveis.map((foto) => (
            <div key={foto.id_anexo} className="relative">
              <a href={foto.url} target="_blank" rel="noreferrer">
                <img
                  src={foto.url}
                  alt="Foto atual"
                  className="h-40 w-40 rounded-lg border border-border object-cover"
                />
              </a>
              {!readOnly && !disabled && (
                <button
                  type="button"
                  onClick={() => alternarExistente(foto.id_anexo)}
                  className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 font-sans text-xs font-semibold text-[#b42318] shadow"
                  aria-label="Remover foto atual"
                >
                  Remover
                </button>
              )}
            </div>
          ))}

          {arquivos.map((arquivo) => (
            <div key={arquivo.chave} className="relative">
              <img
                src={arquivo.preview}
                alt={arquivo.file.name}
                className="h-40 w-40 rounded-lg border border-border object-cover"
              />
              {!readOnly && !disabled && (
                <button
                  type="button"
                  onClick={() => removerArquivo(arquivo.chave)}
                  className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 font-sans text-xs font-semibold text-[#b42318] shadow"
                  aria-label={`Remover ${arquivo.file.name}`}
                >
                  Remover
                </button>
              )}
              <span className="mt-1 block max-w-40 truncate font-sans text-xs text-[#697077]">
                {arquivo.file.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {!readOnly && removidos.length > 0 && (
        <span className="font-sans text-xs text-[#8a5a00]">
          {removidos.length} foto(s) marcada(s) para remoção ao salvar.
        </span>
      )}
    </div>
  );
}
