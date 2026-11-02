import { redirect } from "next/navigation";
import Button from "@/components/Button";
import FichaRelatorio from "@/components/relatorios/FichaRelatorio";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { contagem, formatarQuantidade } from "@/lib/formatar";
import { fichaProduto } from "@/lib/fichas-relatorio";
import { metadadosEmissao, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
  fotos?: string | string[];
  codigos?: string | string[];
};

const ROTULOS_SITUACAO = {
  ativas: "Ativas",
  inativas: "Inativas",
  todas: "Todas",
} as const;

export default async function RelatorioProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarProdutos(await searchParams);
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({ situacao: filtros.situacao });
  if (filtros.fotos) query.set("fotos", "1");
  if (filtros.codigos) query.set("codigos", "1");

  const filtrosFormulario = (
    <form method="get" action="/relatorios/produtos" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Situação
        <select
          name="situacao"
          defaultValue={filtros.situacao}
          className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
        >
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
          <option value="todas">Todas</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="fotos"
          value="1"
          defaultChecked={filtros.fotos}
          className="size-4 accent-[#1b9956]"
        />
        Listar fotos
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="codigos"
          value="1"
          defaultChecked={filtros.codigos}
          className="size-4 accent-[#1b9956]"
        />
        Listar códigos
      </label>
      <Button label="Filtrar" type="submit" />
    </form>
  );

  return (
    <RelatorioCadastro
      titulo="Lista de Produtos"
      descricao="Produtos cadastrados, com saldo, reserva, unidades e códigos personalizados."
      exportHref={`/relatorios/produtos/export?${query}`}
      filtros={filtrosFormulario}
      meta={[
        `Situação: ${ROTULOS_SITUACAO[filtros.situacao]}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        contagem(data.length, "produto", "produtos"),
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhum produto encontrado."
      totais={[
        { rotulo: "Total", valor: formatarQuantidade(totais.quantidade) },
        { rotulo: "Livre", valor: formatarQuantidade(totais.livre) },
      ]}
    >
      {data.map((produto) => (
        <FichaRelatorio key={produto.id_produto} {...fichaProduto(produto, filtros)} />
      ))}
    </RelatorioCadastro>
  );
}
