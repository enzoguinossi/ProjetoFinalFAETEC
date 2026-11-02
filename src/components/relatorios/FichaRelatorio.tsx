import type { FichaRelatorioDados } from "@/types/relatorio";

/**
 * Um registro de cadastro no layout "ficha" do relatório impresso:
 * cabeçalho (código, título e situação), corpo (foto opcional + campos),
 * faixa opcional de contatos e grade com todos os códigos personalizados.
 *
 * Server component: só apresenta os dados montados pelo adaptador.
 */
export default function FichaRelatorio({
  codigo,
  titulo,
  situacao,
  fotoUrl,
  linhas,
  codigos,
  contatos,
  fotoAlt,
}: FichaRelatorioDados & { fotoAlt?: string }) {
  const ativo = situacao === "Ativo";
  const totalContatos = contatos
    ? contatos.emails.length + contatos.telefones.length
    : 0;
  const temEmails = Boolean(contatos && contatos.emails.length > 0);
  const temTelefones = Boolean(contatos && contatos.telefones.length > 0);

  return (
    <article className="ficha">
      <header className="ficha-cabecalho">
        <span className="ficha-codigo">{codigo}</span>
        <h2 className="ficha-titulo">{titulo}</h2>
        <span className={`ficha-situacao ${ativo ? "ficha-ativo" : "ficha-inativo"}`}>
          <span className="ficha-situacao-marca" aria-hidden="true" />
          {situacao}
        </span>
      </header>

      <div className="ficha-corpo">
        {fotoUrl !== undefined &&
          (fotoUrl ? (
            <img
              className="ficha-foto"
              src={fotoUrl}
              alt={fotoAlt ?? `Foto de ${titulo}`}
              width={60}
              height={60}
            />
          ) : (
            <div className="ficha-foto ficha-foto-vazia">Sem foto</div>
          ))}

        <div className="ficha-campos">
          {linhas.map((linha, indice) => (
            <div
              key={indice}
              className="ficha-linha"
              style={{ gridTemplateColumns: `repeat(${linha.length}, minmax(0, 1fr))` }}
            >
              {linha.map((campo) => (
                <div key={campo.rotulo} className="ficha-campo">
                  <span className="ficha-rotulo">{campo.rotulo}</span>
                  <span className="ficha-valor">{campo.valor}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {contatos !== undefined && totalContatos > 0 && (
        <div className="ficha-contatos">
          <div className="ficha-contatos-titulo">Contatos · {totalContatos}</div>
          <div
            className="ficha-contatos-grade"
            style={{
              gridTemplateColumns:
                temEmails && temTelefones ? "1.15fr 1fr" : "1fr",
            }}
          >
            {contatos.emails.length > 0 && (
              <div>
                <div className="ficha-contatos-grupo-titulo">
                  E-mails · {contatos.emails.length}
                </div>
                {contatos.emails.map((contato, indice) => (
                  <div className="ficha-contato" key={`email-${indice}`}>
                    <span>{contato.valor}</span>
                    {contato.principal && (
                      <span className="ficha-contato-principal">principal</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {contatos.telefones.length > 0 && (
              <div>
                <div className="ficha-contatos-grupo-titulo">
                  Telefones · {contatos.telefones.length}
                </div>
                {contatos.telefones.map((contato, indice) => (
                  <div className="ficha-contato" key={`telefone-${indice}`}>
                    <span>{contato.valor}</span>
                    {contato.tipo && (
                      <>
                        <span className="ficha-contato-sep">·</span>
                        <span className="ficha-contato-tipo">{contato.tipo}</span>
                      </>
                    )}
                    {contato.principal && (
                      <span className="ficha-contato-principal">principal</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {codigos !== undefined && codigos.length > 0 && (
        <div className="ficha-codigos">
          <div className="ficha-codigos-titulo">Códigos · {codigos.length}</div>
          <ul className="ficha-codigos-grade">
            {codigos.map((item) => (
              <li key={`${item.tipo}-${item.codigo}`} className="ficha-codigo-item">
                <span className="ficha-codigo-tipo">{item.tipo}</span>
                <span className="ficha-codigo-valor" title={item.codigo}>
                  {item.codigo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
