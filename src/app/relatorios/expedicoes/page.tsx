import { Fragment } from "react";
import { redirect } from "next/navigation";
import BadgeStatus from "@/components/relatorios/BadgeStatus";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import CartaoRegistro from "@/components/relatorios/CartaoRegistro";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import { STATUS_EXPEDICAO_RELATORIO } from "@/dao/relatorio";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
  rotuloStatusExpedicao,
} from "@/services/relatorio";

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
    { id: "fotos", rotulo: "Listar fotos", tipo: "checkbox", fixo: true },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    expedicao: filtros.id_expedicoes.map(String),
    destinatario: filtros.id_destinatarios.map(String),
    condutor: filtros.id_condutores.map(String),
    status: [...filtros.status],
    fotos: filtros.fotos ? ["1"] : [],
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
  if (filtros.fotos) query.set("fotos", "1");

  const statusTexto =
    filtros.status.length === 0
      ? "Todas"
      : filtros.status.map(rotuloStatusExpedicao).join(", ");

  const ordenadas = [...data].sort(
    (a, b) =>
      a.data_prevista.localeCompare(b.data_prevista) ||
      a.id_expedicao - b.id_expedicao,
  );
  const dias: { dia: string; itens: typeof data }[] = [];
  for (const linha of ordenadas) {
    const ultimo = dias[dias.length - 1];
    if (ultimo?.dia === linha.data_prevista) ultimo.itens.push(linha);
    else dias.push({ dia: linha.data_prevista, itens: [linha] });
  }

  function tomStatus(status: string): "forte" | "contorno" | "duplo" {
    if (status === "Concluída") return "forte";
    if (status === "Planejada") return "duplo";
    return "contorno";
  }

  return (
    <RelatorioCadastro
      titulo="Expedições por Período"
      descricao="Expedições com data prevista no período, com veículo, condutor, notas e itens."
      exportHref={`/relatorios/expedicoes/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/expedicoes"
          campos={campos}
          valores={valores}
        />
      }
      meta={[
        ...(expedicoesSelecionadas.length > 0
          ? [
              `${expedicoesSelecionadas.length === 1 ? "Expedição" : "Expedições"}: ${expedicoesSelecionadas
                .map((e) => e.codigo)
                .join(", ")}`,
            ]
          : []),
        ...(destinatariosSelecionados.length > 0
          ? [
              `Destinatário${destinatariosSelecionados.length === 1 ? "" : "s"}: ${destinatariosSelecionados
                .map((d) => d.nome)
                .join(", ")}`,
            ]
          : []),
        ...(condutoresSelecionados.length > 0
          ? [
              `Condutor${condutoresSelecionados.length === 1 ? "" : "es"}: ${condutoresSelecionados
                .map((c) => c.nome)
                .join(", ")}`,
            ]
          : []),
        `Status: ${statusTexto}`,
        `Período: ${formatarDataISO(filtros.de)} a ${formatarDataISO(filtros.ate)}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        `${data.length} expediç${data.length === 1 ? "ão" : "ões"}`,
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhuma expedição encontrada no período."
      totais={[
        { rotulo: "Notas", valor: String(totais.notas) },
        { rotulo: "Solicitados", valor: formatarQuantidade(totais.esperados) },
        { rotulo: "Entregues", valor: formatarQuantidade(totais.entregues) },
      ]}
    >
      {dias.map((grupo) => (
        <Fragment key={grupo.dia}>
          <div className="faixa-dia">
            <span>{formatarDataISO(grupo.dia)}</span>
            <span>
              {grupo.itens.length} expediç{grupo.itens.length === 1 ? "ão" : "ões"}
            </span>
          </div>

          {grupo.itens.map((linha) => (
            <CartaoRegistro
              key={linha.id_expedicao}
              titulo={`Expedição ${formatarCodigo(linha.id_expedicao)}`}
              badge={
                <BadgeStatus tom={tomStatus(linha.status)}>{linha.status}</BadgeStatus>
              }
              direita={`${linha.veiculo} · ${linha.condutor}`}
            >
              <div className="registro-linha">
                <span className="registro-rotulo">Notas</span>
                <span>{linha.notas}</span>
              </div>
              <div className="registro-linha">
                <span className="registro-rotulo">Itens</span>
                <span>
                  {formatarQuantidade(linha.itens_esperados)} solicitados ·{" "}
                  {formatarQuantidade(linha.itens_entregues)} entregues
                </span>
              </div>
              <div className="registro-linha">
                <span className="registro-rotulo">Destinatários</span>
                <span>{linha.destinatarios}</span>
              </div>

              {filtros.fotos && linha.fotos.length > 0 && (
                <div className="registro-fotos">
                  {linha.fotos.slice(0, 4).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt={`Foto da expedição ${linha.id_expedicao}`}
                        width={40}
                        height={40}
                      />
                    </a>
                  ))}
                  {linha.fotos.length > 4 && (
                    <span className="registro-obs">+{linha.fotos.length - 4}</span>
                  )}
                </div>
              )}
            </CartaoRegistro>
          ))}
        </Fragment>
      ))}
    </RelatorioCadastro>
  );
}
