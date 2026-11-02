import type { ReactNode } from "react";

/** Cartão de um registro nos relatórios em faixas. */
export default function CartaoRegistro({
  titulo,
  badge,
  direita,
  children,
}: {
  titulo: ReactNode;
  badge?: ReactNode;
  direita?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="registro">
      <header className="registro-cabecalho">
        <span className="registro-titulo">{titulo}</span>
        {badge}
        {direita && <span className="registro-direita">{direita}</span>}
      </header>
      <div className="registro-corpo">{children}</div>
    </article>
  );
}
