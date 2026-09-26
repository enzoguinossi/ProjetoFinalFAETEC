import Link from "next/link";
import styles from "./Button.module.css";

interface ButtonProps {
  label: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  variant?: "primary" | "cancel" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
}

export default function Button({
  label,
  iconLeft,
  iconRight,
  variant = "primary",
  disabled,
  onClick,
  href,
  type = "button",
}: ButtonProps) {
  const cls = `${styles.btn} ${styles[variant]} ${disabled ? styles.disabled : ""}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
        {label}
        {iconRight && <span className={styles.icon}>{iconRight}</span>}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      {label}
      {iconRight && <span className={styles.icon}>{iconRight}</span>}
    </button>
  );
}