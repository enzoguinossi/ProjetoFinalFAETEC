import type { ReactNode } from "react";

export type IdentityChipTone = "neutral" | "brand" | "warning" | "danger" | "muted";

export type IdentityChip = {
  label: string;
  tone?: IdentityChipTone;
};

const TOM: Record<IdentityChipTone, string> = {
  neutral: "bg-[#eef1f4] text-[#4a4f55]",
  brand: "bg-[rgba(27,153,86,0.12)] text-[#15844a]",
  warning: "bg-[#fff4e5] text-[#8a5a00]",
  danger: "bg-[#fff1f0] text-[#b42318]",
  muted: "bg-[#eef1f4] text-[#697077]",
};

interface IdentityBandProps {
  /** Foto compacta, iniciais ou ícone. */
  media?: ReactNode;
  title: ReactNode;
  /** Metadados curtos: `Código 000001`. */
  meta?: ReactNode;
  chips?: IdentityChip[];
  /** Slot à direita: saldo, switch de status. */
  aside?: ReactNode;
  className?: string;
}

/** Faixa de identidade da ficha (topo do `FormShell`). */
export default function IdentityBand({
  media,
  title,
  meta,
  chips = [],
  aside,
  className = "",
}: IdentityBandProps) {
  return (
    <div
      className={`flex flex-row items-center gap-4 border-b border-border bg-[#f7f9fb] px-8 py-5 ${className}`}
    >
      {media && <div className="shrink-0">{media}</div>}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="m-0 truncate font-display text-lg font-[590] leading-6 tracking-[-0.01rem] text-ink-strong">
          {title}
        </h2>
        {meta && (
          <div className="font-sans text-xs leading-4 text-[#697077]">{meta}</div>
        )}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4 ${
                  TOM[chip.tone ?? "neutral"]
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {aside && (
        <div className="flex w-auto shrink-0 items-center justify-end gap-4">
          {aside}
        </div>
      )}
    </div>
  );
}
