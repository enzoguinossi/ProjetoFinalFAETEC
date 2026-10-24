import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { STATUS_NOTA_RELATORIO } from "@/dao/relatorio";
import {
  formatarDataISO,
  formatarDataRelatorio,
  metadadosEmissao,
  relatorioService,
  rotuloStatusNota,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  destinatario?: string | string[];
  status?: string | string[];
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function RelatorioEntregasPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarEntregas(
    await searchParams,
  );
  const destinatarios = await relatorioService.destinatariosParaFiltro(
    filtros.id_destinatarios,
  );
  const destinatariosSelecionados = destinatarios.filter((d) =>
    filtros.id_destinatarios.includes(d.id_destinatario),
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
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
      id: "status",
      rotulo: "Status",
      tipo: "multi",
      opcoes: STATUS_NOTA_RELATORIO.map((status) => ({
        valor: status,
        rotulo: rotuloStatusNota(status),
      })),
    },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    destinatario: filtros.id_destinatarios.map(String),
    status: [...filtros.status],
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_destinatarios.length > 0) {
    query.set("destinatario", filtros.id_destinatarios.join(","));
  }
  if (filtros.status.length > 0) query.set("status", filtros.status.join(","));

  const statusTexto =
    filtros.status.length === 0
      ? "Todos"
      : filtros.status.map(rotuloStatusNota).join(", ");

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">
            Entregas por Instituição
          </h2>
          <p className="text-sm text-[#697077] m-0">
            Notas de saída por destinatário no período, com itens esperados,
            entregues e pendentes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/entregas/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/entregas"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Entregas por Instituição</h1>
              <div className="meta-info">
                {destinatariosSelecionados.length > 0 && (
                  <p>
                    Destinatário{destinatariosSelecionados.length === 1 ? "" : "s"}:{" "}
                    {destinatariosSelecionados.map((d) => d.nome).join(", ")}
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
                  {data.length} nota{data.length === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "8%" }} className="col-centro">
                    Nota
                  </th>
                  <th style={{ width: "9%" }} className="col-centro">
                    Data
                  </th>
                  <th style={{ width: "22%" }}>Destinatário</th>
                  <th style={{ width: "11%" }} className="col-centro">
                    Status
                  </th>
                  <th style={{ width: "6%" }} className="col-centro">
                    Itens
                  </th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Esperado
                  </th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Entregue
                  </th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Pendente
                  </th>
                  <th style={{ width: "17%" }} className="col-centro">
                    Expedição
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="relatorio-vazio">
                      Nenhuma entrega encontrada no período.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_nota_saida}>
                      <td className="col-centro">{linha.codigo}</td>
                      <td className="col-centro">{formatarDataRelatorio(linha.data)}</td>
                      <td title={linha.destinatario}>{linha.destinatario}</td>
                      <td className="col-centro">{linha.status}</td>
                      <td className="col-centro">{linha.itens}</td>
                      <td className="col-direita">{formatarQuantidade(linha.esperado)}</td>
                      <td className="col-direita">{formatarQuantidade(linha.entregue)}</td>
                      <td className="col-direita">{formatarQuantidade(linha.pendente)}</td>
                      <td className="col-centro">{linha.expedicao}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="relatorio-totais">
              <span>Esperado: {formatarQuantidade(totais.esperado)}</span>
              <span>Entregue: {formatarQuantidade(totais.entregue)}</span>
              <span>Pendente: {formatarQuantidade(totais.pendente)}</span>
            </div>
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
