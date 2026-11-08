import { Fragment } from "react";
import { redirect } from "next/navigation";
import BadgeStatus from "@/components/relatorios/BadgeStatus";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import CartaoRegistro from "@/components/relatorios/CartaoRegistro";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { STATUS_NOTA_RELATORIO, type EntregaRelatorioRow } from "@/dao/relatorio";
import {
  formatarDataISO,
  formatarDataRelatorio,
  metadadosEmissao,
  relatorioService,
  rotuloStatusNota,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  destinatario?: string | string[];
  status?: string | string[];
  fotos?: string | string[];
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
    { id: "fotos", rotulo: "Listar fotos", tipo: "checkbox", fixo: true },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    destinatario: filtros.id_destinatarios.map(String),
    status: [...filtros.status],
    fotos: filtros.fotos ? ["1"] : [],
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_destinatarios.length > 0) {
    query.set("destinatario", filtros.id_destinatarios.join(","));
  }
  if (filtros.status.length > 0) query.set("status", filtros.status.join(","));
  if (filtros.fotos) query.set("fotos", "1");

  const statusTexto =
    filtros.status.length === 0
      ? "Todos"
      : filtros.status.map(rotuloStatusNota).join(", ");

  type GrupoInstituicao = {
    id_destinatario: number;
    nome: string;
    notas: EntregaRelatorioRow[];
    esperado: number;
    entregue: number;
    pendente: number;
  };
  const porInstituicao = new Map<number, GrupoInstituicao>();
  for (const linha of data) {
    const chave = linha.id_destinatario ?? 0;
    const grupo = porInstituicao.get(chave) ?? {
      id_destinatario: chave,
      nome: linha.destinatario,
      notas: [],
      esperado: 0,
      entregue: 0,
      pendente: 0,
    };
    grupo.notas.push(linha);
    grupo.esperado += linha.esperado;
    grupo.entregue += linha.entregue;
    grupo.pendente += linha.pendente;
    porInstituicao.set(chave, grupo);
  }
  const grupos = [...porInstituicao.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );

  function tomStatus(status: string): "forte" | "contorno" | "duplo" {
    if (status === "Baixa total") return "forte";
    if (status === "Cancelada") return "duplo";
    return "contorno";
  }

  return (
    <RelatorioCadastro
      titulo="Entregas por Instituição"
      descricao="Notas de saída por destinatário no período, com itens solicitados, entregues e pendentes."
      exportHref={`/relatorios/entregas/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/entregas"
          campos={campos}
          valores={valores}
        />
      }
      meta={[
        ...(destinatariosSelecionados.length > 0
          ? [
              `Destinatário${destinatariosSelecionados.length === 1 ? "" : "s"}: ${destinatariosSelecionados
                .map((d) => d.nome)
                .join(", ")}`,
            ]
          : []),
        `Status: ${statusTexto}`,
        `Período: ${formatarDataISO(filtros.de)} a ${formatarDataISO(filtros.ate)}`,
        `Emissão: ${emissao.data} ${emissao.hora}`,
        `${data.length} nota${data.length === 1 ? "" : "s"}`,
      ]}
      emissor={emissor}
      quantidade={data.length}
      vazio="Nenhuma entrega encontrada no período."
      totais={[
        { rotulo: "Notas", valor: String(data.length) },
        { rotulo: "Solicitados", valor: formatarQuantidade(totais.esperado) },
        { rotulo: "Entregues", valor: formatarQuantidade(totais.entregue) },
        { rotulo: "Pendentes", valor: formatarQuantidade(totais.pendente) },
      ]}
    >
      {grupos.map((grupo) => (
        <Fragment key={grupo.id_destinatario}>
          <div className="faixa-dia">
            <span>{grupo.nome}</span>
            <span>
              {grupo.notas.length} nota{grupo.notas.length === 1 ? "" : "s"} ·{" "}
              {formatarQuantidade(grupo.esperado)} solicitados ·{" "}
              {formatarQuantidade(grupo.entregue)} entregues ·{" "}
              {formatarQuantidade(grupo.pendente)} pendentes
            </span>
          </div>

          {grupo.notas.map((linha) => (
            <CartaoRegistro
              key={linha.id_nota_saida}
              titulo={`Nota ${linha.codigo} · ${formatarDataRelatorio(linha.data)}`}
              badge={
                <BadgeStatus tom={tomStatus(linha.status)}>{linha.status}</BadgeStatus>
              }
              direita={linha.expedicao}
            >
              <div className="registro-linha">
                <span className="registro-rotulo">Itens</span>
                <span>{linha.itens}</span>
              </div>
              <div className="registro-linha">
                <span className="registro-rotulo">Solicitado</span>
                <span>{formatarQuantidade(linha.esperado)}</span>
              </div>
              <div className="registro-linha">
                <span className="registro-rotulo">Entregue</span>
                <span>{formatarQuantidade(linha.entregue)}</span>
              </div>
              <div className="registro-linha">
                <span className="registro-rotulo">Pendente</span>
                <strong>{formatarQuantidade(linha.pendente)}</strong>
              </div>

              {linha.justificativa && (
                <div className="registro-obs">{linha.justificativa}</div>
              )}

              {filtros.fotos && linha.fotos.length > 0 && (
                <div className="registro-fotos">
                  {linha.fotos.slice(0, 4).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt={`Foto da nota ${linha.codigo}`}
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
