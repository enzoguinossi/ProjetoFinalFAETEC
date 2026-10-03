"use client";

import Button from "@/components/Button";
import styles from "./SearchBar.module.css";

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
    <div className={styles.container}>
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
      <div className={styles.searchWrapper}>
        <input
          className={styles.input}
          type="text"
          placeholder={placeholder}
          onChange={(e) => onSearch?.(e.target.value)}
        />
        <img src="/icons/actions/Lupa.svg" alt="" className={styles.searchIcon} />
      </div>
    </div>
  );
}