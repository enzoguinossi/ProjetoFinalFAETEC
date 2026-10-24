import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { SITUACOES_CADASTRO_RELATORIO } from "@/dao/relatorio";
import {
  metadadosEmissao,
  relatorioService,
  rotuloSituacaoCadastro,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
};

export default async function RelatorioFornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data } = await relatorioService.listarFornecedores(await searchParams);
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
  ];

  const valores = { situacao: [...filtros.situacoes] };

  const query = new URLSearchParams();
  if (filtros.situacoes.length > 0) {
    query.set("situacao", filtros.situacoes.join(","));
  }

  const situacaoTexto =
    filtros.situacoes.length === 0
      ? "Todas"
      : filtros.situacoes.map(rotuloSituacaoCadastro).join(", ");

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Fornecedores</h2>
          <p className="text-sm text-[#697077] m-0">
            Fornecedores cadastrados, com situação, endereço e contato principal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/fornecedores/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/fornecedores"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Fornecedores</h1>
              <div className="meta-info">
                <p>Situação: {situacaoTexto}</p>
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {data.length} fornecedor{data.length === 1 ? "" : "es"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "8%" }} className="col-centro">
                    Código
                  </th>
                  <th style={{ width: "24%" }}>Razão social</th>
                  <th style={{ width: "12%" }} className="col-centro">
                    CNPJ
                  </th>
                  <th style={{ width: "8%" }} className="col-centro">
                    Situação
                  </th>
                  <th style={{ width: "25%" }}>Endereço</th>
                  <th style={{ width: "12%" }}>E-mail</th>
                  <th style={{ width: "11%" }} className="col-centro">
                    Telefone
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="relatorio-vazio">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_fornecedor}>
                      <td className="col-centro">{linha.codigo}</td>
                      <td>{linha.razao_social}</td>
                      <td className="col-centro">{linha.cnpj ?? "—"}</td>
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
