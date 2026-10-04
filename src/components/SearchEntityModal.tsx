"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";

interface SearchEntityModalProps<T> {
  open: boolean;
  onClose: () => void;
  onSelect: (item: T) => void;
  title?: string;
  placeholder?: string;
  searchAction: (query: string) => Promise<T[]>;
  excludeIds?: number[];
  getItemId: (item: T) => number;
  getItemLabel: (item: T) => string;
}

export default function SearchEntityModal<T>({
  open,
  onClose,
  onSelect,
  title: _title = "Buscar",
  placeholder = "Pesquisar...",
  searchAction,
  excludeIds,
  getItemId,
  getItemLabel,
}: SearchEntityModalProps<T>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const timeout = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        let data = await searchAction(query);
        if (excludeIds) {
          data = data.filter((item) => !excludeIds.includes(getItemId(item)));
        }
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, open, excludeIds, searchAction, getItemId]);

  function handleSelect(item: T) {
    onSelect(item);
    setQuery("");
    setResults([]);
    onClose();
  }

  function handleClose() {
    setQuery("");
    setResults([]);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} width="480px">
      <div className="flex items-center gap-2 h-10 px-3 mx-5 border border-[#c1c7cd] rounded-lg bg-white transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
        <img
          src="/icons/actions/Lupa.svg"
          alt=""
          className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-50"
        />
        <input
          ref={inputRef}
          className="flex-1 border-none outline-none bg-transparent font-sans text-sm text-ink h-full min-w-0 placeholder:text-[#8a8f9a]"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-y-auto px-2 py-3 max-h-[40vh]">
        {loading && <p className="p-6 text-center text-[#697077] font-sans text-sm">Buscando...</p>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="p-6 text-center text-[#697077] font-sans text-sm">Nenhum resultado encontrado.</p>
        )}
        {results.map((item) => (
          <button
            key={getItemId(item)}
            className="block w-full px-3 py-[0.625rem] border-none rounded-md bg-transparent text-left font-sans text-sm text-ink cursor-pointer transition-[background-color] duration-100 hover:bg-[#f2f4f8] [&+&]:mt-[2px]"
            onClick={() => handleSelect(item)}
          >
            {getItemLabel(item)}
          </button>
        ))}
      </div>
    </Modal>
  );
}
