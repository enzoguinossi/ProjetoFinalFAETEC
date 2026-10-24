import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
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
      filtros.id_expedicao,
    ),
    relatorioService.destinatariosParaFiltro(filtros.id_destinatario),
    relatorioService.condutoresParaFiltro(filtros.id_condutor),
  ]);
  const expedicao =
    expedicoes.find((e) => e.id_expedicao === filtros.id_expedicao) ?? null;
  const destinatario =
    destinatarios.find((d) => d.id_destinatario === filtros.id_destinatario) ?? null;
  const condutor =
    condutores.find((c) => c.id_funcionario === filtros.id_condutor) ?? null;
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({
    de: filtros.de,
    ate: filtros.ate,
    status: filtros.status,
  });
  if (filtros.id_expedicao !== null) {
    query.set("expedicao", String(filtros.id_expedicao));
  }
  if (filtros.id_destinatario !== null) {
    query.set("destinatario", String(filtros.id_destinatario));
  }
  if (filtros.id_condutor !== null) {
    query.set("condutor", String(filtros.id_condutor));
  }

  return (
    <DashboardLayout title="Relatórios">
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

      <form
        method="get"
        action="/relatorios/expedicoes"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-border p-4"
        data-print-hide
      >
        <label className="flex flex-col gap-1 text-sm text-ink">
          De
          <input
            type="date"
            name="de"
            defaultValue={filtros.de}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={filtros.ate}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Expedição
          <select
            name="expedicao"
            defaultValue={filtros.id_expedicao ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todas as expedições</option>
            {expedicoes.map((e) => (
              <option key={e.id_expedicao} value={e.id_expedicao}>
                {e.codigo} - {formatarDataISO(e.data_prevista)} - {e.veiculo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Destinatário
          <select
            name="destinatario"
            defaultValue={filtros.id_destinatario ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todos os destinatários</option>
            {destinatarios.map((d) => (
              <option key={d.id_destinatario} value={d.id_destinatario}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Condutor
          <select
            name="condutor"
            defaultValue={filtros.id_condutor ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todos os condutores</option>
            {condutores.map((c) => (
              <option key={c.id_funcionario} value={c.id_funcionario}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Status
          <select
            name="status"
            defaultValue={filtros.status}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="todas">Todas</option>
            <option value="PLANEJADA">Planejada</option>
            <option value="EM_PERCURSO">Em percurso</option>
            <option value="CONCLUIDA">Concluída</option>
          </select>
        </label>
        <Button label="Filtrar" type="submit" />
      </form>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Expedições por Período</h1>
              <div className="meta-info">
                {expedicao && <p>Expedição: {expedicao.codigo}</p>}
                {destinatario && <p>Destinatário: {destinatario.nome}</p>}
                {condutor && <p>Condutor: {condutor.nome}</p>}
                <p>Status: {rotuloStatusExpedicao(filtros.status)}</p>
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
    </DashboardLayout>
  );
}
