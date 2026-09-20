import styles from "./SearchBar.module.css";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  onNew?: () => void;
  novoLabel?: string;
}

export default function SearchBar({
  placeholder = "Pesquisar...",
  onSearch,
  onNew,
  novoLabel = "Novo",
}: SearchBarProps) {
  return (
    <div className={styles.container}>
      <button className={styles.novoBtn} onClick={onNew}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {novoLabel}
      </button>
      <div className={styles.searchWrapper}>
        <img src="/icons/actions/search.svg" alt="" className={styles.searchIcon} />
        <input
          className={styles.input}
          type="text"
          placeholder={placeholder}
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
    </div>
  );
}