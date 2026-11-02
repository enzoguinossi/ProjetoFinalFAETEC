import type { ReactNode } from "react";
import Button from "@/components/Button";
import ImprimirButton from "@/components/relatorios/ImprimirButton";

/**
 * Moldura dos relatórios de cadastro no layout "ficha": título e ações da tela,
 * cartão de filtros e a folha A4 com cabeçalho, fichas, totais e rodapé.
 */
export default function RelatorioCadastro({
  titulo,
  descricao,
  exportHref,
  filtros,
  meta,
  emissor,
  quantidade,
  vazio,
  totais,
  children,
}: {
  titulo: string;
  descricao: string;
  /** URL da exportação CSV com os filtros atuais (sem ela, o botão não aparece). */
  exportHref?: string;
  /** Formulário/barra de filtros (fica oculto na impressão). */
  filtros: ReactNode;
  /** Linhas do cabeçalho da folha: filtros aplicados, emissão e contagem. */
  meta: string[];
  emissor: string;
  /** Quantidade de registros; zero mostra o aviso de vazio. */
  quantidade: number;
  vazio: string;
  totais?: { rotulo: string; valor: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">{titulo}</h2>
          <p className="text-sm text-[#697077] m-0">{descricao}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          {exportHref && (
            <Button label="Exportar CSV" href={exportHref} variant="ghost" />
          )}
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        {filtros}
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">{titulo}</h1>
              <div className="meta-info">
                {meta.map((linha) => (
                  <p key={linha}>{linha}</p>
                ))}
              </div>
            </header>

            {quantidade === 0 ? (
              <p className="relatorio-vazio">{vazio}</p>
            ) : (
              <div className="relatorio-fichas">{children}</div>
            )}

            {totais && totais.length > 0 && (
              <div className="relatorio-totais-ficha">
                {totais.map((total) => (
                  <span key={total.rotulo}>
                    <b>{total.rotulo}</b>
                    {total.valor}
                  </span>
                ))}
              </div>
            )}
          </div>

          <footer className="relatorio-footer">
            <span>Emissor: {emissor}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </>
  );
}
