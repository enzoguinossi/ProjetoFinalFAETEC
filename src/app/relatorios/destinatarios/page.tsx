import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import {
  SITUACOES_CADASTRO_RELATORIO,
  TIPOS_DESTINATARIO_RELATORIO,
} from "@/dao/relatorio";
import {
  metadadosEmissao,
  relatorioService,
  rotuloSituacaoCadastro,
  rotuloTipoDestinatario,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
  tipo?: string | string[];
};

export default async function RelatorioDestinatariosPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data } = await relatorioService.listarDestinatarios(await searchParams);
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const campos: CampoFiltro[] = [
    {
      id: "situacao",
      rotulo: "Situação",
      tipo: "multi",
      opcoes: SITUACOES_CADASTRO_RELATORIO.map((situacao) => ({
        valor: situacao,
        rotulo: rotuloSituacaoCadastro(situacao),
      })),
    },
    {
      id: "tipo",
      rotulo: "Tipo",
      tipo: "multi",
      opcoes: TIPOS_DESTINATARIO_RELATORIO.map((tipo) => ({
        valor: tipo,
        rotulo: rotuloTipoDestinatario(tipo),
      })),
    },
  ];

  const valores = {
    situacao: [...filtros.situacoes],
    tipo: [...filtros.tipos],
  };

  const query = new URLSearchParams();
  if (filtros.situacoes.length > 0) {
    query.set("situacao", filtros.situacoes.join(","));
  }
  if (filtros.tipos.length > 0) query.set("tipo", filtros.tipos.join(","));

  const situacaoTexto =
    filtros.situacoes.length === 0
      ? "Todas"
      : filtros.situacoes.map(rotuloSituacaoCadastro).join(", ");
  const tipoTexto =
    filtros.tipos.length === 0
      ? "Todos"
      : filtros.tipos.map(rotuloTipoDestinatario).join(", ");

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Destinatários</h2>
          <p className="text-sm text-[#697077] m-0">
            Escolas e creches atendidas, com tipo, situação, endereço e contato principal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/destinatarios/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/destinatarios"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Destinatários</h1>
              <div className="meta-info">
                <p>Situação: {situacaoTexto}</p>
                <p>Tipo: {tipoTexto}</p>
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {data.length} destinatário{data.length === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "7%" }} className="col-centro">
                    Código
                  </th>
                  <th style={{ width: "20%" }}>Razão social</th>
                  <th style={{ width: "11%" }} className="col-centro">
                    CNPJ
                  </th>
                  <th style={{ width: "7%" }} className="col-centro">
                    Tipo
                  </th>
                  <th style={{ width: "7%" }} className="col-centro">
                    Situação
                  </th>
                  <th style={{ width: "24%" }}>Endereço</th>
                  <th style={{ width: "13%" }}>E-mail</th>
                  <th style={{ width: "11%" }} className="col-centro">
                    Telefone
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="relatorio-vazio">
                      Nenhum destinatário encontrado.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_destinatario}>
                      <td className="col-centro">{linha.codigo}</td>
                      <td>{linha.razao_social}</td>
                      <td className="col-centro">{linha.cnpj ?? "—"}</td>
                      <td className="col-centro">{linha.tipo}</td>
                      <td className="col-centro">{linha.situacao}</td>
                      <td title={linha.endereco}>{linha.endereco}</td>
                      <td title={linha.email ?? undefined}>{linha.email ?? "—"}</td>
                      <td className="col-centro">{linha.telefone ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="relatorio-footer">
            <span>Emissor: {emissor}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </DashboardLayout>
  );
}
