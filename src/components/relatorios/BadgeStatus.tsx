import type { ReactNode } from "react";

/** Selo de status compartilhado pelos relatórios. */
export default function BadgeStatus({
  children,
  tom = "contorno",
}: {
  children: ReactNode;
  tom?: "forte" | "contorno" | "duplo";
}) {
  return <span className={`badge-status badge-status-${tom}`}>{children}</span>;
}
