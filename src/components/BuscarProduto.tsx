"use client";

import { useEffect, useRef, useState } from "react";
import { searchProdutos } from "@/app/produtos/novo/actions";
import type { ProdutoItem } from "@/app/produtos/novo/actions";
import styles from "./BuscarProduto.module.css";

interface BuscarProdutoProps {
  open: boolean;
  onClose: () => void;
  onSelect: (produto: ProdutoItem) => void;
  excludeIds?: number[];
}

export default function BuscarProduto({
  open,
  onClose,
  onSelect,
  excludeIds,
}: BuscarProdutoProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProdutoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProdutos(query);
        setResults(excludeIds ? data.filter((p) => !excludeIds.includes(p.id_produto)) : data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, open, excludeIds]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Buscar Produto</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          placeholder="Digite o nome ou código do produto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className={styles.list}>
          {loading && <p className={styles.status}>Buscando...</p>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className={styles.status}>Nenhum produto encontrado.</p>
          )}
          {results.map((p) => (
            <button
              key={p.id_produto}
              className={styles.item}
              onClick={() => {
                onSelect(p);
                onClose();
              }}
            >
              {p.descricao}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}