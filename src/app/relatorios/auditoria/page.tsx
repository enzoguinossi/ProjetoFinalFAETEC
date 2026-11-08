import { Fragment } from "react";
import { redirect } from "next/navigation";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import type { AuditoriaRelatorioRow } from "@/dao/relatorio";
import { requireUser } from "@/lib/auth";
import { descricaoEvento, rotuloAcao, rotuloEntidade, acaoTemDiff } from "@/lib/auditoria";
import {
  diffAuditoria,
  type CampoDiff,
  type SituacaoItem,
} from "@/lib/auditoria-diff";
import { usuarioPode } from "@/lib/permissoes";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  formatarDataRelatorio,
  metadadosEmissao,
  relatorioService,
} from "@/services/relatorio";
import ImprimirButton from "@/components/relatorios/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  usuario?: string | string[];
  entidade?: string | string[];
  acao?: string | string[];
};

type Colecao = {
  nome: string;
  itens: {
    item: string;
    situacao: SituacaoItem;
    campos: CampoDiff[];
  }[];
};

function ValorDiff({ valor }: { valor: string }) {
  if (valor === "[oculto]") {
    return <span className="auditoria-selo">oculto</span>;
  }
  return <>{valor}</>;
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Agrupa os campos de coleção em blocos preservando a ordem do diff. */
function agruparColecoes(alteracoes: CampoDiff[]): Colecao[] {
  const colecoes: Colecao[] = [];
  const porNome = new Map<string, Colecao>();

  for (const alteracao of alteracoes) {
    if (!alteracao.grupo || !alteracao.item) continue;
    let colecao = porNome.get(alteracao.grupo);
    if (!colecao) {
      colecao = { nome: alteracao.grupo, itens: [] };
      porNome.set(alteracao.grupo, colecao);
      colecoes.push(colecao);
    }

    let item = colecao.itens.find((atual) => atual.item === alteracao.item);
    if (!item) {
      item = {
        item: alteracao.item,
        situacao: alteracao.situacao ?? "alterado",
        campos: [],
      };
      colecao.itens.push(item);
    }
    item.campos.push(alteracao);
  }

  return colecoes;
}

export default async function RelatorioAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, total, referencias } = await relatorioService.listarAuditoria(
    await searchParams,
  );
  const { usuarios, entidades, acoes } =
    await relatorioService.opcoesFiltroAuditoria();
  const usuariosSelecionados = usuarios.filter((u) =>
    filtros.id_usuarios.includes(u.id_usuario),
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  // Os dados já vêm em ordem decrescente: agrupa dias consecutivos.
  const dias: { dia: string; registros: AuditoriaRelatorioRow[] }[] = [];
  for (const linha of data) {
    const dia = formatarDataRelatorio(linha.data_hora);
    const ultimo = dias[dias.length - 1];
    if (ultimo?.dia === dia) ultimo.registros.push(linha);
    else dias.push({ dia, registros: [linha] });
  }

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "usuario",
      rotulo: "Usuário",
      tipo: "multi",
      opcoes: usuarios.map((u) => ({
        valor: String(u.id_usuario),
        rotulo: u.nome,
      })),
    },
    {
      id: "entidade",
      rotulo: "Entidade",
      tipo: "multi",
      opcoes: entidades.map((entidade) => ({
        valor: entidade,
        rotulo: rotuloEntidade(entidade),
      })),
    },
    {
      id: "acao",
      rotulo: "Ação",
      tipo: "multi",
      opcoes: acoes.map((acao) => ({
        valor: acao,
        rotulo: rotuloAcao(acao),
      })),
    },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    usuario: filtros.id_usuarios.map(String),
    entidade: [...filtros.entidades],
    acao: [...filtros.acoes],
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_usuarios.length > 0) {
    query.set("usuario", filtros.id_usuarios.join(","));
  }
  if (filtros.entidades.length > 0) query.set("entidade", filtros.entidades.join(","));
  if (filtros.acoes.length > 0) query.set("acao", filtros.acoes.join(","));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Auditoria</h2>
          <p className="text-sm text-[#697077] m-0">
            Trilha de auditoria do sistema no período, com usuário, ação,
            entidade e registro afetado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/auditoria/export?${query.toString()}`}
            variant="ghost"
          />
          <Button
            label="Exportar XLSX"
            href={`/relatorios/auditoria/export?${query.toString()}&formato=xlsx`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/auditoria"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Auditoria</h1>
              <div className="meta-info">
                {usuariosSelecionados.length > 0 && (
                  <p>
                    Usuário{usuariosSelecionados.length === 1 ? "" : "s"}:{" "}
                    {usuariosSelecionados.map((u) => u.nome).join(", ")}
                  </p>
                )}
                {filtros.entidades.length > 0 && (
                  <p>
                    Entidade{filtros.entidades.length === 1 ? "" : "s"}:{" "}
                    {filtros.entidades.map(rotuloEntidade).join(", ")}
                  </p>
                )}
                {filtros.acoes.length > 0 && (
                  <p>
                    Aç{filtros.acoes.length === 1 ? "ão" : "ões"}:{" "}
                    {filtros.acoes.map(rotuloAcao).join(", ")}
                  </p>
                )}
                <p>
                  Período: {formatarDataISO(filtros.de)} a {formatarDataISO(filtros.ate)}
                </p>
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {total} registro{total === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            {data.length === 0 ? (
              <p className="relatorio-vazio">
                Nenhum registro de auditoria encontrado no período.
              </p>
            ) : (
              dias.map((grupo) => (
                <Fragment key={grupo.dia}>
                  <div className="auditoria-dia">
                    <strong>{grupo.dia}</strong>
                    <span>
                      {plural(grupo.registros.length, "registro", "registros")}
                    </span>
                  </div>

                  {grupo.registros.map((linha) => {
                    const alteracoes = acaoTemDiff(linha.acao)
                      ? diffAuditoria(
                          linha.dados_anteriores,
                          linha.dados_novos,
                          referencias,
                        )
                      : [];
                    const simples = alteracoes.filter(
                      (alteracao) => alteracao.grupo === null,
                    );
                    const colecoes = agruparColecoes(alteracoes);
                    const descricao = descricaoEvento(linha, referencias);

                    return (
                      <div
                        className="auditoria-evento"
                        key={linha.id_registro_auditoria}
                      >
                        <div className="auditoria-evento-linha">
                          <span className="auditoria-hora">
                            {formatarDataHoraRelatorio(linha.data_hora).split(" ")[1]}
                          </span>
                          <span className="auditoria-usuario" title={linha.usuario}>
                            {linha.usuario}
                          </span>
                          <span className="auditoria-acao">
                            {rotuloAcao(linha.acao)}
                          </span>
                          <span className="auditoria-entidade">
                            {rotuloEntidade(linha.entidade)}
                          </span>
                          {linha.id_entidade_afetada !== null && (
                            <span className="auditoria-registro">
                              #{linha.id_entidade_afetada}
                            </span>
                          )}
                          {descricao && (
                            <span className="auditoria-ref">· {descricao}</span>
                          )}
                          <span className="auditoria-resumo">
                            {plural(simples.length, "campo", "campos")} ·{" "}
                            {plural(colecoes.length, "coleção", "coleções")}
                          </span>
                        </div>

                        {alteracoes.length === 0 ? (
                          <p className="auditoria-sem-diff">
                            Sem alteração de dados neste evento.
                          </p>
                        ) : (
                          <>
                            {simples.length > 0 && (
                              <div className="auditoria-simples">
                                {simples.map((alteracao, indice) => (
                                  <div
                                    className="auditoria-simples-linha"
                                    key={`${alteracao.campo}-${indice}`}
                                  >
                                    <strong>{alteracao.campo}:</strong>{" "}
                                    <ValorDiff valor={alteracao.antes} />{" "}
                                    <span>→</span>{" "}
                                    <ValorDiff valor={alteracao.depois} />
                                  </div>
                                ))}
                              </div>
                            )}

                            {colecoes.map((colecao) => {
                              const novas = colecao.itens.filter(
                                (item) => item.situacao === "novo",
                              ).length;
                              const removidas = colecao.itens.filter(
                                (item) => item.situacao === "removido",
                              ).length;
                              const visiveis = colecao.itens.slice(0, 12);
                              const restantes = colecao.itens.length - visiveis.length;

                              return (
                                <div className="auditoria-colecao" key={colecao.nome}>
                                  <div className="auditoria-colecao-titulo">
                                    {colecao.nome} · {colecao.itens.length}
                                    {novas > 0 && ` · ${novas} nova${novas === 1 ? "" : "s"}`}
                                    {removidas > 0 &&
                                      ` · ${removidas} removida${
                                        removidas === 1 ? "" : "s"
                                      }`}
                                  </div>

                                  {visiveis.map((item) => {
                                    const [itemId, ...resto] = item.item.split(" · ");
                                    const itemDescricao = resto.join(" · ");

                                    return (
                                      <div className="auditoria-item" key={item.item}>
                                        <div className="auditoria-item-cabecalho">
                                          <span className="auditoria-item-id">
                                            {itemId}
                                          </span>
                                          {itemDescricao && (
                                            <span className="auditoria-item-desc">
                                              {itemDescricao}
                                            </span>
                                          )}
                                          {item.situacao !== "alterado" && (
                                            <span className="auditoria-selo">
                                              {item.situacao}
                                            </span>
                                          )}
                                        </div>
                                        <div className="auditoria-item-campos">
                                          {item.campos.map((alteracao, indice) => (
                                            <div
                                              className="auditoria-item-campo"
                                              key={`${alteracao.campo}-${indice}`}
                                            >
                                              <span className="auditoria-item-campo-rotulo">
                                                {alteracao.campo}
                                              </span>
                                              <span className="auditoria-item-campo-valor">
                                                <ValorDiff valor={alteracao.antes} />{" "}
                                                <span>→</span>{" "}
                                                <ValorDiff valor={alteracao.depois} />
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {restantes > 0 && (
                                    <div className="auditoria-item auditoria-ref">
                                      +{restantes} ite{restantes === 1 ? "m" : "ns"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))
            )}

            <div className="relatorio-totais">
              <span>Registros: {total.toLocaleString("pt-BR")}</span>
            </div>
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
