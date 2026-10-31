"use client";

import { Fragment, useEffect, useState } from "react";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import FotosField from "@/components/FotosField";
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
  onConfirm: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  processando: boolean;
}) {
  const pendentes = nota.itens_detalhe.filter(
    (item) => item.qtd_esperada - item.qtd_entregue > 0.000001,
  );
  const completos = nota.itens_detalhe.filter(
    (item) => item.qtd_esperada - item.qtd_entregue <= 0.000001,
  );

  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      pendentes.map((item) => [
        item.id_item_nota_saida,
        String(item.qtd_esperada - item.qtd_entregue),
      ]),
    ),
  );
  const [cortar, setCortar] = useState(false);

  const invalido =
    pendentes.length === 0 ||
    pendentes.some((item) => {
      const pendente = item.qtd_esperada - item.qtd_entregue;
      const valor = Number(valores[item.id_item_nota_saida] ?? "");
      return (
        valores[item.id_item_nota_saida] === "" ||
        !Number.isFinite(valor) ||
        valor < 0 ||
        valor > pendente
      );
    });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (invalido) return;

    const itens = pendentes.map((item) => ({
      id_item_nota_saida: item.id_item_nota_saida,
      qtd_entregue:
        item.qtd_entregue + Number(valores[item.id_item_nota_saida] ?? 0),
    }));

    const formData = new FormData(e.currentTarget);
    formData.set("itens", JSON.stringify(itens));
    formData.set("cortar_restante", cortar ? "on" : "");
    await onConfirm(formData);
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <p className="m-0 font-sans text-sm text-[#697077]">
        Nota {nota.codigo} — informe quanto será <strong>entregue agora</strong> em
        cada item com pendência. O já entregue não é alterado.
      </p>

      {pendentes.length === 0 ? (
        <p className="m-0 rounded-[1rem] border border-border-input bg-[#f8f9fb] px-4 py-3 font-sans text-sm text-[#697077]">
          Todos os itens já foram entregues.
        </p>
      ) : (
        <div className="flex w-full flex-col overflow-x-auto rounded-[1rem] border border-[#e2e8f0]">
          <div
            className="grid min-w-[560px] bg-brand px-[0.6875rem] py-2 font-display text-sm text-white [font-weight:590]"
            style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 1fr" }}
          >
            <div>Item</div>
            <div className="text-center">Esperada</div>
            <div className="text-center">Já entregue</div>
            <div className="text-center">Pendente</div>
            <div className="text-center">Entregar agora</div>
          </div>
          {pendentes.map((item, indice) => {
            const pendente = item.qtd_esperada - item.qtd_entregue;
            return (
              <div
                key={item.id_item_nota_saida}
                className={`grid min-w-[560px] items-center px-[0.6875rem] py-2 font-sans text-sm text-ink ${
                  indice % 2 === 1 ? "bg-table-alt!" : "bg-white"
                }`}
                style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 1fr" }}
              >
                <div className="overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                  {item.descricao}
                </div>
                <div className="text-center">{formatarNumero(item.qtd_esperada)}</div>
                <div className="text-center">{formatarNumero(item.qtd_entregue)}</div>
                <div className="text-center">{formatarNumero(pendente)}</div>
                <div className="px-1">
                  <input
                    type="number"
                    min={0}
                    max={pendente}
                    step="any"
                    value={valores[item.id_item_nota_saida] ?? ""}
                    onChange={(e) =>
                      setValores((atual) => ({
                        ...atual,
                        [item.id_item_nota_saida]: e.target.value,
                      }))
                    }
                    className={`${ui.input} h-9`}
                    aria-label={`Entregar agora de ${item.descricao}`}
                    disabled={processando}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completos.length > 0 && (
        <div className="rounded-lg border border-border bg-[#f8fafb] p-3 font-sans text-sm">
          <span className="font-semibold text-ink-strong">
            Itens já completos (somente leitura)
          </span>
          <div className="mt-1 flex flex-col gap-0.5 text-[#697077]">
            {completos.map((item) => (
              <span key={item.id_item_nota_saida}>
                {item.descricao}: {formatarNumero(item.qtd_entregue)} de{" "}
                {formatarNumero(item.qtd_esperada)}
              </span>
            ))}
          </div>
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

      <FotosField
        initial={[]}
        max={5}
        allowUrl={false}
        label="Fotos da entrega (opcional)"
        name="fotos"
        disabled={processando}
      />

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
  const [motivoNaoEntrega, setMotivoNaoEntrega] = useState("");
  const [erroNaoEntrega, setErroNaoEntrega] = useState<string | null>(null);
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

  async function confirmarEntrega(formData: FormData) {
    if (!notaEntrega) return;
    const ok = await executar(
      () =>
        registrarEntregaNota(
          detalhe.id_expedicao,
          notaEntrega.id_nota_saida,
          formData,
        ),
      "Entrega registrada.",
    );
    if (ok) setNotaEntrega(null);
  }

  async function confirmarNaoEntregue(formData: FormData) {
    if (!notaNaoEntregue) return;
    setProcessando(true);
    setErroNaoEntrega(null);
    try {
      const resultado = await marcarNotaNaoEntregue(
        detalhe.id_expedicao,
        notaNaoEntregue.id_nota_saida,
        formData,
      );
      if ("error" in resultado && resultado.error) {
        setErroNaoEntrega(resultado.error);
        return;
      }
      mostrarAviso("Nota marcada como não entregue.", "sucesso");
      setNotaNaoEntregue(null);
      await recarregar();
    } catch {
      setErroNaoEntrega("Erro ao registrar a não entrega. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  function abrirNaoEntrega(nota: ExpedicaoNotaRow) {
    setMotivoNaoEntrega("");
    setErroNaoEntrega(null);
    setNotaNaoEntregue(nota);
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
            <Fragment key={nota.id_nota_saida}>
              <div
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
                        onClick={() => abrirNaoEntrega(nota)}
                        disabled={processando}
                      >
                        Não entregue
                      </button>
                    </>
                  ) : (
                    <span className="font-sans text-xs text-[#697077]">
                      {nota.justificativa ? "Não entregue" : "Entrega registrada"}
                    </span>
                  )}
                </div>
              )}
              </div>
              {(nota.data_tentativa || nota.justificativa || nota.fotos.length > 0) && (
                <div className="flex min-w-[720px] flex-col gap-2 border-t border-[#e2e8f0] bg-[#fbfcfd] px-[0.6875rem] py-3 font-sans text-sm text-ink">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#697077]">
                    {nota.data_tentativa && (
                      <span>
                        Tentativa: {nota.data_tentativa}
                        {nota.usuario_tentativa
                          ? ` · ${nota.usuario_tentativa}`
                          : ""}
                      </span>
                    )}
                    {nota.saldo_pendente > 0 && (
                      <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 font-semibold text-[#7a4100]">
                        {
                          nota.itens_detalhe.filter(
                            (item) =>
                              item.qtd_esperada - item.qtd_entregue > 0.000001,
                          ).length
                        }{" "}
                        item(ns) pendente(s)
                      </span>
                    )}
                  </div>
                  {nota.justificativa && (
                    <span>Justificativa: {nota.justificativa}</span>
                  )}
                  {nota.fotos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {nota.fotos.map((foto) => (
                        <a
                          key={foto.id_anexo}
                          href={foto.url}
                          target="_blank"
                          rel="noreferrer"
                          title={foto.nome_arquivo}
                        >
                          <img
                            src={foto.url}
                            alt={foto.nome_arquivo}
                            width={64}
                            height={64}
                            style={{ width: 64, height: 64 }}
                            className="rounded border border-border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Fragment>
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

      <Modal
        open={notaNaoEntregue !== null}
        onClose={() => setNotaNaoEntregue(null)}
        title="Não entregue"
        width="680px"
      >
        {notaNaoEntregue && (
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              void confirmarNaoEntregue(new FormData(event.currentTarget));
            }}
          >
            <p className="m-0 font-sans text-sm text-[#697077]">
              Marcar a nota {notaNaoEntregue.codigo} como não entregue? Nada é
              baixado do estoque e a reserva continua para outra expedição.
            </p>

            <div className={ui.field}>
              <label className={ui.label} htmlFor="motivo-nao-entrega">
                Motivo / justificativa da não entrega
              </label>
              <textarea
                id="motivo-nao-entrega"
                name="justificativa"
                required
                maxLength={1000}
                rows={4}
                value={motivoNaoEntrega}
                onChange={(event) => setMotivoNaoEntrega(event.target.value)}
                className="w-full rounded-lg border border-border-input bg-white px-3 py-2 font-sans text-sm text-ink outline-none focus:border-brand"
                placeholder="Ex.: escola fechada, responsável ausente..."
              />
              <span className="self-end font-sans text-xs text-[#697077]">
                {motivoNaoEntrega.length}/1000
              </span>
            </div>

            <FotosField
              key={`nao-entrega-${notaNaoEntregue.id_nota_saida}`}
              initial={[]}
              max={5}
              allowUrl={false}
              label="Fotos da não entrega (opcional)"
              name="fotos"
              disabled={processando}
            />

            {erroNaoEntrega && (
              <p className="m-0 rounded-lg bg-[#fdecea] px-3 py-2 font-sans text-sm text-[#8a1c1c]">
                {erroNaoEntrega}
              </p>
            )}

            <div className={ui.rowActions}>
              <Button
                label="Cancelar"
                variant="cancel"
                onClick={() => setNotaNaoEntregue(null)}
                disabled={processando}
              />
              <Button
                label="Registrar não entrega"
                variant="primary"
                type="submit"
                disabled={processando || motivoNaoEntrega.trim().length === 0}
              />
            </div>
          </form>
        )}
      </Modal>

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
