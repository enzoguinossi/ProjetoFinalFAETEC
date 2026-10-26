"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import { useAviso } from "@/components/AvisoProvider";
import { ui } from "@/lib/ui";
import { hojeISO } from "@/lib/formatar";
import type { PermissoesEntidade } from "@/types";
import AdicionarNotasModal from "./AdicionarNotasModal";
import {
  concluirExpedicao,
  despacharExpedicao,
  listarCondutoresParaExpedicao,
  listarVeiculosParaExpedicao,
  marcarNotaNaoEntregue,
  moverNotasExpedicao,
  obterExpedicao,
  registrarEntregaNota,
  removerNotaExpedicao,
  salvarExpedicao,
  type CondutorExpedicaoRow,
  type ExpedicaoFormData,
  type ExpedicaoNotaRow,
  type VeiculoExpedicaoRow,
} from "../actions";

interface Props {
  inicial: ExpedicaoFormData;
  perms: PermissoesEntidade;
}

function formatarData(valor: string | null): string {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(
    valor,
  );
}

const statusCls: Record<string, string> = {
  PLANEJADA: "bg-[#e8f0fe] text-[#001d6c]",
  EM_PERCURSO: "bg-[#fff4e5] text-[#7a4100]",
  CONCLUIDA: "bg-[#e7f6ec] text-[#0f5132]",
};

function EntregaForm({
  nota,
  onConfirm,
  onCancel,
  processando,
}: {
  nota: ExpedicaoNotaRow;
  onConfirm: (
    itens: { id_item_nota_saida: number; qtd_entregue: number }[],
    cortar: boolean,
  ) => Promise<void>;
  onCancel: () => void;
  processando: boolean;
}) {
  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      nota.itens_detalhe.map((item) => [
        item.id_item_nota_saida,
        String(item.qtd_esperada),
      ]),
    ),
  );
  const [cortar, setCortar] = useState(false);

  const itens = nota.itens_detalhe.map((item) => ({
    ...item,
    valor: Number(valores[item.id_item_nota_saida] ?? ""),
  }));

  const invalido = itens.some(
    (item) =>
      valores[item.id_item_nota_saida] === "" ||
      !Number.isFinite(item.valor) ||
      item.valor < item.qtd_entregue ||
      item.valor > item.qtd_esperada,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (invalido) return;

    await onConfirm(
      itens.map((item) => ({
        id_item_nota_saida: item.id_item_nota_saida,
        qtd_entregue: item.valor,
      })),
      cortar,
    );
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <p className="m-0 font-sans text-sm text-[#697077]">
        Nota {nota.codigo} — informe a quantidade entregue <strong>total</strong> por
        item. Sem corte, o restante continua reservado para outra expedição.
      </p>

      {nota.itens_detalhe.length === 0 ? (
        <p className="m-0 rounded-[1rem] border border-border-input bg-[#f8f9fb] px-4 py-3 font-sans text-sm text-[#697077]">
          Esta nota não possui itens.
        </p>
      ) : (
        <div className="flex w-full flex-col overflow-x-auto rounded-[1rem] border border-[#e2e8f0]">
          <div
            className="grid min-w-[520px] bg-brand px-[0.6875rem] py-2 font-display text-sm text-white [font-weight:590]"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1.2fr" }}
          >
            <div>Item</div>
            <div className="text-center">Esperada</div>
            <div className="text-center">Já entregue</div>
            <div className="text-center">Entrega (total)</div>
          </div>
          {itens.map((item, indice) => (
            <div
              key={item.id_item_nota_saida}
              className={`grid min-w-[520px] items-center px-[0.6875rem] py-2 font-sans text-sm text-ink ${
                indice % 2 === 1 ? "bg-table-alt!" : "bg-white"
              }`}
              style={{ gridTemplateColumns: "2fr 1fr 1fr 1.2fr" }}
            >
              <div className="overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                {item.descricao}
              </div>
              <div className="text-center">{formatarNumero(item.qtd_esperada)}</div>
              <div className="text-center">{formatarNumero(item.qtd_entregue)}</div>
              <div className="px-1">
                <input
                  type="number"
                  min={item.qtd_entregue}
                  max={item.qtd_esperada}
                  step="any"
                  value={valores[item.id_item_nota_saida] ?? ""}
                  onChange={(e) =>
                    setValores((atual) => ({
                      ...atual,
                      [item.id_item_nota_saida]: e.target.value,
                    }))
                  }
                  className={`${ui.input} h-9`}
                  aria-label={`Quantidade entregue de ${item.descricao}`}
                  disabled={processando}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 font-sans text-base text-ink-strong">
        <input
          type="checkbox"
          checked={cortar}
          onChange={(e) => setCortar(e.target.checked)}
          className="h-[1.125rem] w-[1.125rem] accent-brand"
          disabled={processando}
        />
        Cortar o restante (não será entregue)
      </label>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={onCancel} />
        <Button
          label="Registrar entrega"
          type="submit"
          disabled={invalido || processando}
        />
      </div>
    </form>
  );
}

function ExpedicaoEdicaoForm({
  inicial,
  onSaved,
  onCancel,
}: {
  inicial: ExpedicaoFormData;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const mostrarAviso = useAviso();
  const [dataPrevista, setDataPrevista] = useState(
    inicial.data_prevista ?? hojeISO(),
  );
  const [observacao, setObservacao] = useState(inicial.observacao ?? "");
  const [idVeiculo, setIdVeiculo] = useState(
    inicial.id_veiculo ? String(inicial.id_veiculo) : "",
  );
  const [idCondutor, setIdCondutor] = useState(
    inicial.id_funcionario_condutor
      ? String(inicial.id_funcionario_condutor)
      : "",
  );
  const [veiculos, setVeiculos] = useState<VeiculoExpedicaoRow[]>([]);
  const [condutores, setCondutores] = useState<CondutorExpedicaoRow[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      const [listaVeiculos, listaCondutores] = await Promise.all([
        listarVeiculosParaExpedicao({ page: 1, limit: 100 }),
        listarCondutoresParaExpedicao({ page: 1, limit: 100 }),
      ]);
      if (!ativo) return;
      setVeiculos(listaVeiculos.data);
      setCondutores(listaCondutores.data);
    })();

    return () => {
      ativo = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idVeiculo) {
      mostrarAviso("Selecione o veículo.", "erro");
      return;
    }
    if (!idCondutor) {
      mostrarAviso("Selecione o condutor.", "erro");
      return;
    }
    setSalvando(true);
    try {
      const form = new FormData();
      form.set("id_expedicao", String(inicial.id_expedicao));
      form.set("data_prevista", dataPrevista);
      form.set("observacao", observacao);
      form.set("id_veiculo", idVeiculo);
      form.set("id_funcionario_condutor", idCondutor);

      const resultado = await salvarExpedicao(form);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }

      mostrarAviso("Alterações salvas com sucesso.", "sucesso");
      onSaved();
    } catch {
      mostrarAviso("Erro ao salvar a expedição.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <div className={ui.field}>
        <label className={ui.label}>Data prevista</label>
        <input
          type="date"
          value={dataPrevista}
          onChange={(e) => setDataPrevista(e.target.value)}
          className={ui.input}
          required
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label}>Observação</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className={`${ui.input} h-auto py-2 resize-y`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={ui.field}>
          <label className={ui.label}>Veículo</label>
          <select
            value={idVeiculo}
            onChange={(e) => setIdVeiculo(e.target.value)}
            className={ui.select}
            required
          >
            <option value="" disabled>
              Selecione o veículo
            </option>
            {veiculos.map((veiculo) => (
              <option key={veiculo.id_veiculo} value={veiculo.id_veiculo}>
                {veiculo.placa}
                {veiculo.modelo ? ` — ${veiculo.modelo}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Condutor</label>
          <select
            value={idCondutor}
            onChange={(e) => setIdCondutor(e.target.value)}
            className={ui.select}
            required
          >
            <option value="" disabled>
              Selecione o condutor
            </option>
            {condutores.map((condutor) => (
              <option key={condutor.id_funcionario} value={condutor.id_funcionario}>
                {condutor.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={ui.rowActions}>
        <Button label="Cancelar" variant="cancel" onClick={onCancel} />
        <Button
          label="Salvar"
          variant="primary"
          type="submit"
          disabled={salvando}
        />
      </div>
    </form>
  );
}

export default function ExpedicaoClient({ inicial, perms }: Props) {
  const mostrarAviso = useAviso();
  const [detalhe, setDetalhe] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [buscandoNota, setBuscandoNota] = useState(false);
  const [notaParaRemover, setNotaParaRemover] =
    useState<ExpedicaoNotaRow | null>(null);
  const [despachando, setDespachando] = useState(false);
  const [notaEntrega, setNotaEntrega] = useState<ExpedicaoNotaRow | null>(null);
  const [notaNaoEntregue, setNotaNaoEntregue] =
    useState<ExpedicaoNotaRow | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [processando, setProcessando] = useState(false);

  const planejada = detalhe.status === "PLANEJADA";
  const emPercurso = detalhe.status === "EM_PERCURSO";
  const podeAlterar = perms.canEdit && planejada;
  const podeExecutar = perms.canEdit && emPercurso;

  async function recarregar() {
    const atualizado = await obterExpedicao(detalhe.id_expedicao);
    if (atualizado) setDetalhe(atualizado);
  }

  async function executar(
    acao: () => Promise<{ error?: string; success?: boolean }>,
    mensagem: string,
  ): Promise<boolean> {
    setProcessando(true);
    try {
      const resultado = await acao();
      if ("error" in resultado && resultado.error) {
        mostrarAviso(resultado.error, "erro");
        return false;
      }
      mostrarAviso(mensagem, "sucesso");
      await recarregar();
      return true;
    } catch {
      mostrarAviso("Erro ao concluir a ação.", "erro");
      return false;
    } finally {
      setProcessando(false);
    }
  }

  function mover(indice: number, delta: number) {
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= detalhe.notas.length) return;

    const copia = [...detalhe.notas];
    const [item] = copia.splice(indice, 1);
    if (!item) return;
    copia.splice(alvo, 0, item);

    void executar(
      () =>
        moverNotasExpedicao(
          detalhe.id_expedicao,
          copia.map((nota) => nota.id_nota_saida),
        ),
      "Ordem atualizada.",
    );
  }

  async function confirmarRemocao() {
    if (!notaParaRemover) return;
    const ok = await executar(
      () =>
        removerNotaExpedicao(
          detalhe.id_expedicao,
          notaParaRemover.id_nota_saida,
        ),
      "Nota removida da expedição.",
    );
    if (ok) setNotaParaRemover(null);
  }

  async function confirmarDespacho() {
    const ok = await executar(
      () => despacharExpedicao(detalhe.id_expedicao),
      "Expedição despachada.",
    );
    if (ok) setDespachando(false);
  }

  async function confirmarEntrega(
    itens: { id_item_nota_saida: number; qtd_entregue: number }[],
    cortar: boolean,
  ) {
    if (!notaEntrega) return;
    const ok = await executar(
      () =>
        registrarEntregaNota(
          detalhe.id_expedicao,
          notaEntrega.id_nota_saida,
          itens,
          cortar,
        ),
      "Entrega registrada.",
    );
    if (ok) setNotaEntrega(null);
  }

  async function confirmarNaoEntregue() {
    if (!notaNaoEntregue) return;
    const ok = await executar(
      () =>
        marcarNotaNaoEntregue(
          detalhe.id_expedicao,
          notaNaoEntregue.id_nota_saida,
        ),
      "Nota marcada como não entregue.",
    );
    if (ok) setNotaNaoEntregue(null);
  }

  async function confirmarConclusao() {
    const ok = await executar(
      () => concluirExpedicao(detalhe.id_expedicao),
      "Expedição concluída.",
    );
    if (ok) setConcluindo(false);
  }

  const colunaAcoes = podeAlterar || podeExecutar;
  const gridNotas = podeExecutar
    ? "4.5rem 6rem 2.4fr 1fr 0.8fr 15rem"
    : podeAlterar
      ? "4.5rem 6rem 2.4fr 1fr 0.8fr 10.5rem"
      : "4.5rem 6rem 2.4fr 1fr 0.8fr";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button label="Voltar" variant="ghost" href="/expedicoes" />
        <div className="flex flex-wrap items-center gap-2">
          {perms.canEdit && planejada && (
            <Button label="Editar" variant="ghost" onClick={() => setEditando(true)} />
          )}
          {perms.canEdit && planejada && (
            <Button
              label="Despachar"
              variant="primary"
              onClick={() => setDespachando(true)}
              disabled={processando}
            />
          )}
          {podeExecutar && (
            <Button
              label="Concluir expedição"
              variant="primary"
              onClick={() => setConcluindo(true)}
              disabled={processando}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[1.25rem] border border-[#e2e8f0] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs uppercase tracking-[0.02em] text-[#697077]">
                Data prevista
              </span>
              <span className="font-sans text-base text-ink-strong">
                {formatarData(detalhe.data_prevista)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs uppercase tracking-[0.02em] text-[#697077]">
                Status
              </span>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 font-sans text-xs font-semibold ${
                  statusCls[detalhe.status] ?? "bg-[#f2f4f8] text-ink"
                }`}
              >
                {detalhe.statusLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs uppercase tracking-[0.02em] text-[#697077]">
                Veículo
              </span>
              <span className="font-sans text-base text-ink-strong">
                {detalhe.veiculo ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs uppercase tracking-[0.02em] text-[#697077]">
                Condutor
              </span>
              <span className="font-sans text-base text-ink-strong">
                {detalhe.condutor ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {detalhe.observacao && (
          <div className="flex flex-col gap-1 border-t border-[#f2f4f8] pt-3">
            <span className="font-sans text-xs uppercase tracking-[0.02em] text-[#697077]">
              Observação
            </span>
            <p className="m-0 font-sans text-sm text-ink">{detalhe.observacao}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-[590] text-ink-strong">
          Notas da expedição ({detalhe.notas.length})
        </h2>
        {podeAlterar && (
          <Button
            label="Adicionar nota"
            onClick={() => setBuscandoNota(true)}
            disabled={processando}
          />
        )}
      </div>

      {detalhe.notas.length === 0 ? (
        <p className="m-0 rounded-[1rem] border border-border-input bg-[#f8f9fb] px-4 py-3 font-sans text-sm text-[#697077]">
          Nenhuma nota nesta expedição. Adicione notas elegíveis para montar o
          manifesto.
        </p>
      ) : (
        <div className="flex w-full flex-col overflow-x-auto rounded-[1.25rem] border border-[#e2e8f0]">
          <div
            className="grid min-w-[720px] bg-brand font-display text-base text-white [font-weight:590] tracking-[-0.028125rem]"
            style={{ gridTemplateColumns: gridNotas }}
          >
            <div className="px-[0.6875rem] py-2 text-center">Ordem</div>
            <div className="px-[0.6875rem] py-2 text-center">Código</div>
            <div className="px-[0.6875rem] py-2">Destinatário</div>
            <div className="px-[0.6875rem] py-2 text-center">Status</div>
            <div className="px-[0.6875rem] py-2 text-right">Itens</div>
            {colunaAcoes && (
              <div className="px-[0.6875rem] py-2 text-center">Ações</div>
            )}
          </div>

          {detalhe.notas.map((nota, indice) => (
            <div
              key={nota.id_nota_saida}
              className={`grid min-w-[720px] items-center bg-white font-sans text-base text-ink ${
                indice % 2 === 1 ? "bg-table-alt!" : ""
              }`}
              style={{ gridTemplateColumns: gridNotas }}
            >
              <div className="px-[0.6875rem] py-2 text-center font-semibold">
                {nota.ordem_visita}
              </div>
              <div className="px-[0.6875rem] py-2 text-center whitespace-nowrap">
                {nota.codigo}
              </div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap px-[0.6875rem] py-2">
                {nota.destinatario ?? "—"}
              </div>
              <div className="px-[0.6875rem] py-2 text-center text-sm">
                {nota.statusLabel}
              </div>
              <div className="px-[0.6875rem] py-2 text-right text-sm">
                {nota.itens}
              </div>
              {podeAlterar && (
                <div className="flex items-center justify-center gap-1 px-[0.6875rem] py-1">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink cursor-pointer disabled:cursor-default disabled:opacity-40"
                    aria-label={`Subir ${nota.codigo}`}
                    title="Subir"
                    disabled={indice === 0 || processando}
                    onClick={() => mover(indice, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink cursor-pointer disabled:cursor-default disabled:opacity-40"
                    aria-label={`Descer ${nota.codigo}`}
                    title="Descer"
                    disabled={
                      indice === detalhe.notas.length - 1 || processando
                    }
                    onClick={() => mover(indice, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ml-1 rounded-md border border-border bg-white px-2 py-1 font-sans text-[0.8125rem] text-danger cursor-pointer transition-[background-color] duration-100 hover:bg-danger-bg"
                    onClick={() => setNotaParaRemover(nota)}
                    disabled={processando}
                  >
                    Remover
                  </button>
                </div>
              )}
              {podeExecutar && (
                <div className="flex flex-wrap items-center justify-center gap-1 px-[0.6875rem] py-1">
                  {nota.status === "EM_PERCURSO" ? (
                    <>
                      <button
                        type="button"
                        className="rounded-md border border-brand bg-brand px-2 py-1 font-sans text-[0.8125rem] font-semibold text-white cursor-pointer transition-[background-color] duration-100 hover:bg-brand-hover disabled:cursor-default disabled:opacity-50"
                        onClick={() => setNotaEntrega(nota)}
                        disabled={processando}
                      >
                        Registrar entrega
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border bg-white px-2 py-1 font-sans text-[0.8125rem] text-ink cursor-pointer transition-[background-color] duration-100 hover:bg-[#f2f4f8] disabled:cursor-default disabled:opacity-50"
                        onClick={() => setNotaNaoEntregue(nota)}
                        disabled={processando}
                      >
                        Não entregue
                      </button>
                    </>
                  ) : (
                    <span className="font-sans text-xs text-[#697077]">
                      Entrega registrada
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editando}
        onClose={() => setEditando(false)}
        title="Editar expedição"
        width="760px"
      >
        <ExpedicaoEdicaoForm
          inicial={detalhe}
          onSaved={() => {
            setEditando(false);
            void recarregar();
          }}
          onCancel={() => setEditando(false)}
        />
      </Modal>

      <AdicionarNotasModal
        open={buscandoNota}
        onClose={() => setBuscandoNota(false)}
        idExpedicao={detalhe.id_expedicao}
        notas={detalhe.notas}
        onAlterada={recarregar}
      />

      <ConfirmDialog
        open={notaParaRemover !== null}
        onClose={() => setNotaParaRemover(null)}
        onConfirm={() => {
          void confirmarRemocao();
        }}
        title="Remover nota"
        message={`Remover a nota ${notaParaRemover?.codigo ?? ""} da expedição? A nota continua existindo e a ordem das demais é renumerada.`}
        confirmLabel="Remover"
        loading={processando}
      />

      <ConfirmDialog
        open={despachando}
        onClose={() => setDespachando(false)}
        onConfirm={() => {
          void confirmarDespacho();
        }}
        title="Despachar expedição"
        message="Despachar a expedição? Ela passa para Em percurso, as notas também, e o veículo fica Em expedição."
        confirmLabel="Despachar"
        loading={processando}
      />

      <Modal
        open={notaEntrega !== null}
        onClose={() => setNotaEntrega(null)}
        title="Registrar entrega"
        width="760px"
      >
        {notaEntrega && (
          <EntregaForm
            key={notaEntrega.id_nota_saida}
            nota={notaEntrega}
            onConfirm={confirmarEntrega}
            onCancel={() => setNotaEntrega(null)}
            processando={processando}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={notaNaoEntregue !== null}
        onClose={() => setNotaNaoEntregue(null)}
        onConfirm={() => {
          void confirmarNaoEntregue();
        }}
        title="Não entregue"
        message={`Marcar a nota ${notaNaoEntregue?.codigo ?? ""} como não entregue? Nada é baixado do estoque e a reserva continua para outra expedição.`}
        confirmLabel="Marcar como não entregue"
        loading={processando}
      />

      <ConfirmDialog
        open={concluindo}
        onClose={() => setConcluindo(false)}
        onConfirm={() => {
          void confirmarConclusao();
        }}
        title="Concluir expedição"
        message="Concluir a expedição? As notas que ainda estiverem em percurso passam a Pendente, a expedição vai para Concluída e o veículo volta a ficar Disponível."
        confirmLabel="Concluir"
        loading={processando}
      />
    </div>
  );
}
