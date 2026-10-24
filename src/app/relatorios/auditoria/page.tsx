import { redirect } from "next/navigation";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  usuario?: string | string[];
  entidade?: string | string[];
  acao?: string | string[];
};

/** Registro afetado na linha: `#id` ou `—` quando a ação não tem registro. */
function registroAfetado(id: number | null): string {
  return id === null ? "—" : `#${id}`;
}

export default async function RelatorioAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, total } = await relatorioService.listarAuditoria(
    await searchParams,
  );
  const { usuarios, entidades, acoes } =
    await relatorioService.opcoesFiltroAuditoria();
  const usuariosSelecionados = usuarios.filter((u) =>
    filtros.id_usuarios.includes(u.id_usuario),
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

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
        rotulo: entidade,
      })),
    },
    {
      id: "acao",
      rotulo: "Ação",
      tipo: "multi",
      opcoes: acoes.map((acao) => ({ valor: acao, rotulo: acao })),
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
                    {filtros.entidades.join(", ")}
                  </p>
                )}
                {filtros.acoes.length > 0 && (
                  <p>
                    Aç{filtros.acoes.length === 1 ? "ão" : "ões"}:{" "}
                    {filtros.acoes.join(", ")}
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

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "15%" }} className="col-centro">
                    Data/hora
                  </th>
                  <th style={{ width: "30%" }}>Usuário</th>
                  <th style={{ width: "17%" }} className="col-centro">
                    Ação
                  </th>
                  <th style={{ width: "26%" }}>Entidade</th>
                  <th style={{ width: "12%" }} className="col-centro">
                    Registro
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="relatorio-vazio">
                      Nenhum registro de auditoria encontrado no período.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_registro_auditoria}>
                      <td className="col-centro">
                        {formatarDataHoraRelatorio(linha.data_hora)}
                      </td>
                      <td title={linha.usuario}>{linha.usuario}</td>
                      <td className="col-centro">{linha.acao}</td>
                      <td>{linha.entidade}</td>
                      <td className="col-centro">
                        {registroAfetado(linha.id_entidade_afetada)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="relatorio-totais">
              <span>
                Registros: {total.toLocaleString("pt-BR")}
              </span>
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
