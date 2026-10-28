import type { ReactNode } from "react";

/**
 * Layout de relatório ampliado (A4 paisagem), reutilizável por relatórios com
 * mais colunas/dados. A estrutura base (`relatorio-*`) é a mesma dos demais; o
 * que muda é a folha mais larga e a tabela com `table-layout: auto`
 * (`.relatorio-tabela-ampliada`), que cresce pelo conteúdo em vez de espremer
 * as colunas.
 */
export default function RelatorioAmpliado({
  titulo,
  meta,
  children,
  emissor,
}: {
  titulo: string;
  /** Linhas do cabeçalho (filtros aplicados, emissão, contagem). */
  meta: string[];
  children: ReactNode;
  emissor: string;
}) {
  return (
    <div className="relatorio-scroll">
      <div className="relatorio-container relatorio-ampliado">
        <div className="relatorio-conteudo">
          <header className="relatorio-header">
            <h1 className="titulo-relatorio">{titulo}</h1>
            <div className="meta-info">
              {meta.map((linha) => (
                <p key={linha}>{linha}</p>
              ))}
            </div>
          </header>

          {children}
        </div>

        <footer className="relatorio-footer">
          <span>Emissor: {emissor}</span>
          <span>Documento gerado para uso interno</span>
        </footer>
      </div>
    </div>
  );
}
