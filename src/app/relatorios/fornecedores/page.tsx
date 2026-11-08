import { redirect } from "next/navigation";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import FichaRelatorio from "@/components/relatorios/FichaRelatorio";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { SITUACOES_CADASTRO_RELATORIO } from "@/dao/relatorio";
import { contagem } from "@/lib/formatar";
import { fichaFornecedor } from "@/lib/fichas-relatorio";
import {
  metadadosEmissao,
  relatorioService,
  rotuloSituacaoCadastro,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
  codigos?: string | string[];
  contatos?: string | string[];
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
    { id: "codigos", rotulo: "Listar códigos", tipo: "checkbox", fixo: true },
    { id: "contatos", rotulo: "Listar contatos", tipo: "checkbox", fixo: true },
  ];

  const valores = {
    situacao: [...filtros.situacoes],
    codigos: filtros.codigos ? ["1"] : [],
    contatos: filtros.contatos ? ["1"] : [],
  };

  const query = new URLSearchParams();
  if (filtros.situacoes.length > 0) {
    query.set("situacao", filtros.situacoes.join(","));
  }
  if (filtros.codigos) query.set("codigos", "1");
  if (filtros.contatos) query.set("contatos", "1");

  const situacaoTexto =
    filtros.situacoes.length === 0
      ? "Todas"
      : filtros.situacoes.map(rotuloSituacaoCadastro).join(", ");

  return (
    <RelatorioCadastro
      titulo="Fornecedores"
      descricao="Fornecedores cadastrados, com situação, endereço e contato principal."
      exportHref={`/relatorios/fornecedores/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/fornecedores"
          campos={campos}
          valores={valores}
        />
      }
      meta={[
        `Situação: ${situacaoTexto}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        contagem(data.length, "fornecedor", "fornecedores"),
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhum fornecedor encontrado."
    >
      {data.map((fornecedor) => (
        <FichaRelatorio key={fornecedor.id_fornecedor} {...fichaFornecedor(fornecedor, filtros)} />
      ))}
    </RelatorioCadastro>
  );
}
