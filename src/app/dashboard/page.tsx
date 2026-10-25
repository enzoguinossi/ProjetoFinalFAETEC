import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";
import MuralCard from "@/components/dashboard/MuralCard";
import MovementChart from "@/components/dashboard/MovementChart";
import StockChart from "@/components/dashboard/StockChart";
import StatusChart from "@/components/dashboard/StatusChart";
import { gerarAlertasValidade } from "@/services/alerta-validade";
import { muralService, type MuralMensagem } from "@/services/mural";
import { muralDAO } from "@/dao/mural";
import { dashboardDAO } from "@/dao/dashboard";
import type { MuralMensagemDTO } from "./actions";

export const dynamic = "force-dynamic";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

function paraDTO(mensagem: MuralMensagem): MuralMensagemDTO {
  return {
    id: mensagem.id_mensagem_mural,
    titulo: mensagem.titulo,
    conteudo: mensagem.conteudo,
    data_publicacao: mensagem.data_publicacao.toISOString(),
    data_expiracao: mensagem.data_expiracao?.toISOString() ?? null,
    automatica: mensagem.automatica,
    ativo: mensagem.ativo,
    autor: mensagem.autor,
  };
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-border p-4"
      data-figma="DashboardKpi"
      data-figma-label={rotulo}
    >
      <div className="mb-1 text-[0.6875rem] uppercase text-[#8a8f9a]">{rotulo}</div>
      <div className="text-2xl font-bold">{valor}</div>
      <div
        className={`mt-1 text-[0.6875rem] ${alerta ? "text-[#d97706]" : "text-[#8a8f9a]"}`}
      >
        {detalhe}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  // Alertas de validade (RN002) são atualizados antes de carregar o mural.
  // Falhas aqui não podem bloquear o dashboard.
  try {
    await gerarAlertasValidade();
  } catch (erro) {
    console.error(
      "[dashboard] gerarAlertasValidade:",
      erro instanceof Error ? erro.message : erro,
    );
  }

  const [
    podeVerEstoque,
    podeVerNotas,
    podeVerExpedicoes,
    podeCriarMural,
    podeAlterarMural,
    podeExcluirMural,
  ] = await Promise.all([
    usuarioPode(user, "estoque.ver_saldo"),
    usuarioPode(user, "nota_saida.consultar"),
    usuarioPodeAlguma(user, ["expedicao.listar", "expedicao.consultar"]),
    usuarioPode(user, "mural.criar"),
    usuarioPode(user, "mural.alterar"),
    usuarioPode(user, "mural.excluir"),
  ]);

  const [mensagens, vistoEm, resumo] = await Promise.all([
    muralService.listarAtivas(),
    muralDAO.obterVistoEm(user.id_usuario),
    dashboardDAO.obterResumo({
      estoque: podeVerEstoque,
      notas: podeVerNotas,
      expedicoes: podeVerExpedicoes,
    }),
  ]);

  const { estoque, movimentacoes, topProdutos, statusNotas, pendencias } = resumo;

  return (
    <>
      <PageTitle>Dashboard</PageTitle>

      <div className="grid grid-cols-2 gap-3 mb-4 xl:grid-cols-5">
        <Kpi
          rotulo="Itens em estoque"
          valor={podeVerEstoque ? numero.format(estoque.itens) : "—"}
          detalhe={
            podeVerEstoque
              ? "soma das quantidades em estoque"
              : "sem permissão para ver o saldo"
          }
        />
        <Kpi
          rotulo="Produtos com saldo"
          valor={podeVerEstoque ? numero.format(estoque.produtosComSaldo) : "—"}
          detalhe="produtos com quantidade atual positiva"
        />
        <Kpi
          rotulo="Saídas pendentes"
          valor={podeVerNotas ? numero.format(resumo.saidasPendentes) : "—"}
          detalhe={
            podeVerNotas
              ? "notas em pendente ou baixa parcial"
              : "sem permissão para ver notas"
          }
          alerta={podeVerNotas && resumo.saidasPendentes > 0}
        />
        <Kpi
          rotulo="Expedições ativas"
          valor={podeVerExpedicoes ? numero.format(resumo.expedicoesAtivas) : "—"}
          detalhe={
            podeVerExpedicoes
              ? "expedições em percurso"
              : "sem permissão para ver expedições"
          }
        />
        <Kpi
          rotulo="Vencendo em 30 dias"
          valor={podeVerEstoque ? numero.format(resumo.vencendoEm30Dias) : "—"}
          detalhe={
            podeVerEstoque
              ? "perecíveis com validade até 30 dias"
              : "sem permissão para ver o saldo"
          }
          alerta={podeVerEstoque && resumo.vencendoEm30Dias > 0}
        />
      </div>

      <MuralCard
        mensagens={mensagens.map(paraDTO)}
        vistoEm={vistoEm?.toISOString() ?? null}
        podeCriar={podeCriarMural}
        podeAlterar={podeAlterarMural}
        podeExcluir={podeExcluirMural}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <MovementChart
          labels={movimentacoes.labels}
          entradas={movimentacoes.entradas}
          saidas={movimentacoes.saidas}
          semPermissao={!podeVerNotas}
        />
        <StockChart produtos={topProdutos} semPermissao={!podeVerEstoque} />
        <StatusChart status={statusNotas} semPermissao={!podeVerNotas} />
      </div>

      <section
        className="bg-white rounded-xl border border-border p-4 mb-4"
        data-figma="DashboardPendencias"
      >
        <h3 className="mb-2 text-[0.8125rem] font-semibold">⚠️ Pendências</h3>
        {!podeVerNotas ? (
          <p className="m-0 py-2 text-xs text-[#8a8f9a]">
            Sem permissão para ver as pendências de notas de saída.
          </p>
        ) : pendencias.length === 0 ? (
          <p className="m-0 py-2 text-xs text-[#8a8f9a]">
            Nenhuma pendência no momento.
          </p>
        ) : (
          pendencias.map((pendencia) => (
            <div
              key={pendencia.id_nota_saida}
              className="flex justify-between border-b border-border py-1.5 text-xs last:border-b-0"
            >
              <span>
                Saída #{pendencia.codigo} — {pendencia.destinatario}
              </span>
              <span className="text-[0.6875rem] text-[#d97706]">
                {pendencia.label}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
