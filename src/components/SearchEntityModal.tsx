"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import styles from "./SearchEntityModal.module.css";

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
      <div className={styles.searchWrapper}>
        <img src="/icons/actions/Lupa.svg" alt="" className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {loading && <p className={styles.status}>Buscando...</p>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className={styles.status}>Nenhum resultado encontrado.</p>
        )}
        {results.map((item) => (
          <button
            key={getItemId(item)}
            className={styles.item}
            onClick={() => handleSelect(item)}
          >
            {getItemLabel(item)}
          </button>
        ))}
      </div>
    </Modal>
  );
}