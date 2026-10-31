import type { FotoExistente } from "./FotosField";

/**
 * Galeria read-only de fotos (visualização de cadastro). Miniaturas com link
 * para a imagem completa; usada no modo `view`.
 */
export default function FotosGaleria({
  fotos,
  label = "Foto",
  tamanho = 160,
}: {
  fotos: FotoExistente[];
  label?: string;
  /** Lado da miniatura em pixels. */
  tamanho?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-base font-normal text-ink-strong leading-[1.4]">
        {label}
      </span>
      {fotos.length === 0 ? (
        <span className="font-sans text-sm text-[#697077]">Sem foto.</span>
      ) : (
        <div className="flex flex-wrap gap-3">
          {fotos.map((foto) => (
            <a
              key={foto.id_anexo}
              href={foto.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={foto.url}
                alt="Foto"
                width={tamanho}
                height={tamanho}
                style={{ width: tamanho, height: tamanho }}
                className="rounded-lg border border-border object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
