"use client";

import Button from "@/components/Button";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  onNew?: () => void;
  novoHref?: string;
  novoLabel?: string;
  showNew?: boolean;
}

export default function SearchBar({
  placeholder = "Pesquisar...",
  onSearch,
  onNew,
  novoHref,
  novoLabel = "Novo",
  showNew = true,
}: SearchBarProps) {
  return (
    <div className="flex items-center gap-[0.625rem] w-full h-[2.875rem] px-[0.6875rem] box-border">
      {showNew && (novoHref ? (
        <Button
          label={novoLabel}
          href={novoHref}
          iconLeft={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
      ) : (
        <Button
          label={novoLabel}
          onClick={onNew}
          iconLeft={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
      ))}
      <div className="flex-1 flex items-center gap-2 h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
        <input
          className="flex-1 border-none outline-none bg-transparent font-sans text-sm text-ink h-full min-w-0 placeholder:text-[#8a8f9a]"
          type="text"
          placeholder={placeholder}
          onChange={(e) => onSearch?.(e.target.value)}
        />
        <img
          src="/icons/actions/Lupa.svg"
          alt=""
          className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-50"
        />
      </div>
    </div>
  );
}
