import { redirect } from "next/navigation";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { STATUS_EXPEDICAO_RELATORIO } from "@/dao/relatorio";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
  rotuloStatusExpedicao,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  expedicao?: string | string[];
  destinatario?: string | string[];
  condutor?: string | string[];
  status?: string | string[];
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function RelatorioExpedicoesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarExpedicoes(
    await searchParams,
  );
  const [expedicoes, destinatarios, condutores] = await Promise.all([
    relatorioService.expedicoesParaFiltro(
      { de: filtros.de, ate: filtros.ate },
      filtros.id_expedicoes,
    ),
    relatorioService.destinatariosParaFiltro(filtros.id_destinatarios),
    relatorioService.condutoresParaFiltro(filtros.id_condutores),
  ]);
  const expedicoesSelecionadas = expedicoes.filter((e) =>
    filtros.id_expedicoes.includes(e.id_expedicao),
  );
  const destinatariosSelecionados = destinatarios.filter((d) =>
    filtros.id_destinatarios.includes(d.id_destinatario),
  );
  const condutoresSelecionados = condutores.filter((c) =>
    filtros.id_condutores.includes(c.id_funcionario),
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "expedicao",
      rotulo: "Expedição",
      tipo: "multi",
      opcoes: expedicoes.map((e) => ({
        valor: String(e.id_expedicao),
        rotulo: `${e.codigo} - ${formatarDataISO(e.data_prevista)} - ${e.veiculo}`,
      })),
    },
    {
      id: "destinatario",
      rotulo: "Destinatário",
      tipo: "multi",
      opcoes: destinatarios.map((d) => ({
        valor: String(d.id_destinatario),
        rotulo: d.nome,
      })),
    },
    {
      id: "condutor",
      rotulo: "Condutor",
      tipo: "multi",
      opcoes: condutores.map((c) => ({
        valor: String(c.id_funcionario),
        rotulo: c.nome,
      })),
    },
    {
      id: "status",
      rotulo: "Status",
      tipo: "multi",
      opcoes: STATUS_EXPEDICAO_RELATORIO.map((status) => ({
        valor: status,
        rotulo: rotuloStatusExpedicao(status),
      })),
    },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    expedicao: filtros.id_expedicoes.map(String),
    destinatario: filtros.id_destinatarios.map(String),
    condutor: filtros.id_condutores.map(String),
    status: [...filtros.status],
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_expedicoes.length > 0) {
    query.set("expedicao", filtros.id_expedicoes.join(","));
  }
  if (filtros.id_destinatarios.length > 0) {
    query.set("destinatario", filtros.id_destinatarios.join(","));
  }
  if (filtros.id_condutores.length > 0) {
    query.set("condutor", filtros.id_condutores.join(","));
  }
  if (filtros.status.length > 0) query.set("status", filtros.status.join(","));

  const statusTexto =
    filtros.status.length === 0
      ? "Todas"
      : filtros.status.map(rotuloStatusExpedicao).join(", ");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Expedições por Período</h2>
          <p className="text-sm text-[#697077] m-0">
            Expedições com data prevista no período, com veículo, condutor, notas e
            itens.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/expedicoes/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/expedicoes"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Expedições por Período</h1>
              <div className="meta-info">
                {expedicoesSelecionadas.length > 0 && (
                  <p>
                    {expedicoesSelecionadas.length === 1 ? "Expedição" : "Expedições"}:{" "}
                    {expedicoesSelecionadas.map((e) => e.codigo).join(", ")}
                  </p>
                )}
                {destinatariosSelecionados.length > 0 && (
                  <p>
                    Destinatário{destinatariosSelecionados.length === 1 ? "" : "s"}:{" "}
                    {destinatariosSelecionados.map((d) => d.nome).join(", ")}
                  </p>
                )}
                {condutoresSelecionados.length > 0 && (
                  <p>
                    Condutor{condutoresSelecionados.length === 1 ? "" : "es"}:{" "}
                    {condutoresSelecionados.map((c) => c.nome).join(", ")}
                  </p>
                )}
                <p>Status: {statusTexto}</p>
                <p>
                  Período: {formatarDataISO(filtros.de)} a {formatarDataISO(filtros.ate)}
                </p>
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {data.length} expediç{data.length === 1 ? "ão" : "ões"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "9%" }} className="col-centro">
                    Data prevista
                  </th>
                  <th style={{ width: "10%" }} className="col-centro">
                    Status
                  </th>
                  <th style={{ width: "9%" }} className="col-centro">
                    Veículo
                  </th>
                  <th style={{ width: "16%" }}>Condutor</th>
                  <th style={{ width: "6%" }} className="col-centro">
                    Notas
                  </th>
                  <th style={{ width: "24%" }}>Destinatários</th>
                  <th style={{ width: "13%" }} className="col-direita">
                    Itens esperados
                  </th>
                  <th style={{ width: "13%" }} className="col-direita">
                    Itens entregues
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="relatorio-vazio">
                      Nenhuma expedição encontrada no período.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_expedicao}>
                      <td className="col-centro">
                        {formatarDataISO(linha.data_prevista)}
                      </td>
                      <td className="col-centro">{linha.status}</td>
                      <td className="col-centro">{linha.veiculo}</td>
                      <td title={linha.condutor}>{linha.condutor}</td>
                      <td className="col-centro">{linha.notas}</td>
                      <td title={linha.destinatarios}>{linha.destinatarios}</td>
                      <td className="col-direita">
                        {formatarQuantidade(linha.itens_esperados)}
                      </td>
                      <td className="col-direita">
                        {formatarQuantidade(linha.itens_entregues)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="relatorio-totais">
              <span>Notas: {totais.notas}</span>
              <span>Itens esperados: {formatarQuantidade(totais.esperados)}</span>
              <span>Itens entregues: {formatarQuantidade(totais.entregues)}</span>
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
