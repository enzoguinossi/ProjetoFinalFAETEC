import { redirect } from "next/navigation";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import FichaRelatorio from "@/components/relatorios/FichaRelatorio";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import {
  SITUACOES_CADASTRO_RELATORIO,
  TIPOS_DESTINATARIO_RELATORIO,
} from "@/dao/relatorio";
import { contagem } from "@/lib/formatar";
import { fichaDestinatario } from "@/lib/fichas-relatorio";
import {
  metadadosEmissao,
  relatorioService,
  rotuloSituacaoCadastro,
  rotuloTipoDestinatario,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
  tipo?: string | string[];
  codigos?: string | string[];
  contatos?: string | string[];
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
    { id: "codigos", rotulo: "Listar códigos", tipo: "checkbox", fixo: true },
    { id: "contatos", rotulo: "Listar contatos", tipo: "checkbox", fixo: true },
  ];

  const valores = {
    situacao: [...filtros.situacoes],
    tipo: [...filtros.tipos],
    codigos: filtros.codigos ? ["1"] : [],
    contatos: filtros.contatos ? ["1"] : [],
  };

  const query = new URLSearchParams();
  if (filtros.situacoes.length > 0) {
    query.set("situacao", filtros.situacoes.join(","));
  }
  if (filtros.tipos.length > 0) query.set("tipo", filtros.tipos.join(","));
  if (filtros.codigos) query.set("codigos", "1");
  if (filtros.contatos) query.set("contatos", "1");

  const situacaoTexto =
    filtros.situacoes.length === 0
      ? "Todas"
      : filtros.situacoes.map(rotuloSituacaoCadastro).join(", ");
  const tipoTexto =
    filtros.tipos.length === 0
      ? "Todos"
      : filtros.tipos.map(rotuloTipoDestinatario).join(", ");

  return (
    <RelatorioCadastro
      titulo="Destinatários"
      descricao="Escolas, creches, CMEI e CMEIA atendidos, com tipo, situação, endereço e contato principal."
      exportHref={`/relatorios/destinatarios/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/destinatarios"
          campos={campos}
          valores={valores}
        />
      }
      meta={[
        `Situação: ${situacaoTexto}`,
        `Tipo: ${tipoTexto}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        contagem(data.length, "destinatário", "destinatários"),
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhum destinatário encontrado."
    >
      {data.map((destinatario) => (
        <FichaRelatorio
          key={destinatario.id_destinatario}
          {...fichaDestinatario(destinatario, filtros)}
        />
      ))}
    </RelatorioCadastro>
  );
}
