import { redirect } from "next/navigation";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { contagem } from "@/lib/formatar";
import { produtosComMovimento } from "@/lib/relatorio-movimentacao";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
} from "@/services/relatorio";
import { TabelaExtrato } from "./TabelaExtrato";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  produto?: string | string[];
};

export default async function RelatorioExtratoPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const params = await searchParams;
  const { filtros, data } = await relatorioService.listarMovimentacoes({
    de: params.de,
    ate: params.ate,
    produto: params.produto,
  });
  const produtosOpcoes = await relatorioService.produtosParaFiltro(filtros.id_produtos);
  const produtosSelecionados = produtosOpcoes.filter((produto) =>
    filtros.id_produtos.includes(produto.id_produto),
  );
  const semFiltro = filtros.id_produtos.length === 0;
  const produtosDoExtrato = semFiltro
    ? produtosComMovimento(data)
    : produtosSelecionados;
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const titulo =
    produtosSelecionados.length === 1 ? "Extrato de Produto" : "Extrato de Produtos";

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "produto",
      rotulo: "Produto",
      tipo: "multi",
      opcoes: produtosOpcoes.map((produto) => ({
        valor: String(produto.id_produto),
        rotulo: `${produto.codigo} - ${produto.descricao}`,
      })),
    },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    produto: filtros.id_produtos.map(String),
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_produtos.length > 0) {
    query.set("produto", filtros.id_produtos.join(","));
  }

  const meta = [
    semFiltro
      ? "Produtos: todos"
      : `${produtosSelecionados.length === 1 ? "Produto" : "Produtos"}: ${produtosSelecionados
          .map((produto) => `${produto.codigo} - ${produto.descricao}`)
          .join(", ")}`,
    `Período: ${formatarDataISO(filtros.de)} a ${formatarDataISO(filtros.ate)}`,
    `Emissão: ${emissao.data} ${emissao.hora}`,
    `${contagem(produtosDoExtrato.length, "produto", "produtos")} · ${contagem(
      data.length,
      "movimentação",
      "movimentações",
    )}`,
  ];

  return (
    <RelatorioCadastro
      titulo={titulo}
      descricao="Saldo inicial, movimentações e saldo final dos produtos no período."
      exportHref={`/relatorios/extrato/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/extrato"
          campos={campos}
          valores={valores}
        />
      }
      meta={meta}
      emissor={emissor}
      quantidade={produtosDoExtrato.length}
      vazio="Nenhuma movimentação encontrada no período."
    >
      <TabelaExtrato data={data} produtos={produtosDoExtrato} />
    </RelatorioCadastro>
  );
}
