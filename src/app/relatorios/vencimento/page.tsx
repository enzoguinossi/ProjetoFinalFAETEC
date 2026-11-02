import { Fragment } from "react";
import { redirect } from "next/navigation";
import BadgeStatus from "@/components/relatorios/BadgeStatus";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { DIAS_VENCIMENTO_RELATORIO } from "@/dao/relatorio";
import { contagem, formatarQuantidade } from "@/lib/formatar";
import { agruparVencimento } from "@/lib/relatorio-vencimento";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
  rotuloDiasVencimento,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

type Params = {
  dias?: string | string[];
};

export default async function RelatorioVencimentoPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarProdutosVencimento(
    await searchParams,
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({ dias: String(filtros.dias) }).toString();
  const filtroTexto = rotuloDiasVencimento(filtros.dias);
  const grupos = agruparVencimento(data).filter(
    (grupo) => grupo.itens.length > 0,
  );

  const filtrosFormulario = (
    <form method="get" action="/relatorios/vencimento" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Dias para vencer
        <select
          name="dias"
          defaultValue={String(filtros.dias)}
          className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
        >
          {DIAS_VENCIMENTO_RELATORIO.map((dias) => (
            <option key={dias} value={dias}>
              {rotuloDiasVencimento(dias)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Filtrar
      </button>
    </form>
  );

  return (
    <RelatorioCadastro
      titulo="Produtos Próximos ao Vencimento"
      descricao="Produtos perecíveis com validade, agrupados por urgência."
      exportHref={`/relatorios/vencimento/export?${query}`}
      filtros={filtrosFormulario}
      meta={[
        `Dias para vencer: ${filtroTexto}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        contagem(data.length, "produto", "produtos"),
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhum produto perecível próximo ao vencimento."
      totais={[
        { rotulo: "Itens", valor: String(totais.itens) },
        { rotulo: "Vencidos", valor: String(totais.vencidos) },
      ]}
    >
      <table className="relatorio-faixa">
        <thead>
          <tr>
            <th style={{ width: "52%" }}>Produto</th>
            <th style={{ width: "12%" }} className="col-direita">
              Qtd.
            </th>
            <th style={{ width: "18%" }}>Validade</th>
            <th style={{ width: "18%" }}>Dias restantes</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.id}>
              <tr className="faixa-grupo">
                <td colSpan={4}>
                  <div className="faixa-grupo-linha">
                    <span className="faixa-grupo-nome">{grupo.titulo}</span>
                    <span className="faixa-grupo-dir">
                      {contagem(grupo.itens.length, "item", "itens")}
                    </span>
                  </div>
                </td>
              </tr>

              {grupo.itens.map((linha) => (
                <tr key={linha.id_produto}>
                  <td>
                    <span className="faixa-codigo">{linha.codigo}</span>
                    {linha.descricao}
                  </td>
                  <td className="col-direita">
                    {formatarQuantidade(linha.quantidade)}
                  </td>
                  <td>{formatarDataISO(linha.validade)}</td>
                  <td>
                    <BadgeStatus tom={linha.dias_restantes < 0 ? "forte" : "contorno"}>
                      {linha.dias_restantes < 0
                        ? `há ${Math.abs(linha.dias_restantes)} dias`
                        : linha.dias_restantes === 0
                          ? "hoje"
                          : `em ${linha.dias_restantes} dias`}
                    </BadgeStatus>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </RelatorioCadastro>
  );
}
