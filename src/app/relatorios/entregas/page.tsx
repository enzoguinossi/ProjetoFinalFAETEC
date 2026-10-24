import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
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
    filtros.id_destinatario,
  );
  const destinatario =
    destinatarios.find((d) => d.id_destinatario === filtros.id_destinatario) ?? null;
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({
    de: filtros.de,
    ate: filtros.ate,
    status: filtros.status,
  });
  if (filtros.id_destinatario !== null) {
    query.set("destinatario", String(filtros.id_destinatario));
  }

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

      <form
        method="get"
        action="/relatorios/entregas"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-border p-4"
        data-print-hide
      >
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
          Status
          <select
            name="status"
            defaultValue={filtros.status}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="todos">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="BAIXA_TOTAL">Baixa total</option>
            <option value="BAIXA_PARCIAL">Baixa parcial</option>
            <option value="BAIXA_COM_CORTE">Baixa com corte</option>
            <option value="EM_PERCURSO">Em percurso</option>
            <option value="ABERTA">Aberta</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </label>
        <Button label="Filtrar" type="submit" />
      </form>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Entregas por Instituição</h1>
              <div className="meta-info">
                {destinatario && <p>Destinatário: {destinatario.nome}</p>}
                <p>Status: {rotuloStatusNota(filtros.status)}</p>
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
