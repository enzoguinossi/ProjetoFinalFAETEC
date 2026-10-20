"use client";

import { useState } from "react";
import { createProduto, updateProduto, getProduto, listarProdutos } from "../actions";
import type { ProdutoFormData } from "../actions";
import DataTable from "@/components/DataTable";
import SearchEntityModal from "@/components/SearchEntityModal";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import UnidadesModal from "@/components/UnidadesModal";
import Modal from "@/components/Modal";
import ProdutoView from "./ProdutoView";
import FotoField from "./FotoField";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";

interface Conversao {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
}

interface TipoCodigo {
  id_tipo_codigo: number;
  nome: string;
}

export interface ProdutoItem {
  id_produto: number;
  descricao: string;
}

interface Props {
  conversoes: Conversao[];
  tiposCodigo: TipoCodigo[];
  initialData?: ProdutoFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type InsumoEntry = { id: number; descricao: string; qtd: string };

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none transition-[border-color] duration-[120ms] w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";
const CHECKBOX_LABEL_CLASS =
  "flex items-center gap-2 font-sans text-base font-normal text-ink-strong leading-[1.4] cursor-pointer [&_input[type=checkbox]]:size-[1.125rem] [&_input[type=checkbox]]:accent-brand [&_input[type=checkbox]]:cursor-pointer";

export default function ProdutoForm({
  conversoes, tiposCodigo, initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isEdit = initialData !== undefined;

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [perecivel, setPerecivel] = useState(initialData?.perecivel ?? false);
  const [composto, setComposto] = useState(initialData?.composto ?? false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [idConversao, setIdConversao] = useState(initialData?.id_conversao_padrao ?? null);
  const [conversoesAtuais, setConversoesAtuais] = useState<Conversao[]>(conversoes);
  const [unidadesModalOpen, setUnidadesModalOpen] = useState(false);

  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);

  const [insumos, setInsumos] = useState<InsumoEntry[]>(
    initialData?.insumos.map((i) => ({ id: i.id, descricao: i.descricao, qtd: String(i.qtd) })) ?? [],
  );
  const [editandoIns, setEditandoIns] = useState<number | null>(null);
  const [buscandoIdx, setBuscandoIdx] = useState<number | null>(null);
  const [insumoViewData, setInsumoViewData] = useState<ProdutoFormData | null>(null);

  const insumoColumns: import("@/components/DataTable").Column<InsumoEntry>[] = [
    { key: "descricao", label: "Produto", width: "3fr" },
    {
      key: "qtd", label: "Quantidade", width: "1fr",
      render: (value: string | number, row: InsumoEntry) => (
        <input
          type="number"
          min="0"
          step="any"
          value={String(value)}
          onChange={(e) => {
            const i = insumos.findIndex((ins) => ins.id === row.id && ins.descricao === row.descricao);
            if (i < 0) return;
            const next = [...insumos];
            next[i] = { ...next[i], qtd: e.target.value };
            setInsumos(next);
          }}
          className="w-full h-7 border border-border-input rounded-md px-2 font-sans text-sm outline-none box-border"
        />
      ),
    },
  ];

  // ── Insumos ──

  function iniciarNovoInsumo() {
    const idx = insumos.length;
    setInsumos([...insumos, { id: 0, descricao: "", qtd: "1" }]);
    setBuscandoIdx(idx);
    setEditandoIns(idx);
  }

  function removerInsumo(i: number) {
    setInsumos(insumos.filter((_, idx) => idx !== i));
    if (editandoIns === i) setEditandoIns(null);
  }

  function onSelectInsumo(prod: ProdutoItem) {
    if (buscandoIdx === null) return;
    const next = [...insumos];
    next[buscandoIdx] = { ...next[buscandoIdx], id: prod.id_produto, descricao: prod.descricao };
    setInsumos(next);
    setEditandoIns(null);
    setBuscandoIdx(null);
  }

  const insumoActions = [
    {
      icon: "/icons/actions/Olho.svg",
      label: "Visualizar",
      onClick: async (row: Record<string, unknown>) => {
        const i = insumos.findIndex((ins) => ins.descricao === row.descricao);
        if (i < 0 || insumos[i].id <= 0) return;
        const produto = await getProduto(insumos[i].id);
        if (produto) setInsumoViewData(produto);
      },
    },
    {
      icon: "/icons/actions/Lixeira.svg",
      label: "Excluir",
      onClick: (row: Record<string, unknown>) => {
        const i = insumos.findIndex((ins) => ins.descricao === row.descricao);
        if (i >= 0) removerInsumo(i);
      },
    },
  ];

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_produto", String(initialData.id_produto));
      form.set("codigos", JSON.stringify(codigos));
      form.set("insumos", JSON.stringify(insumos.map((i) => ({ id: i.id, qtd: i.qtd }))));
      const result = initialData
        ? await updateProduto(form)
        : await createProduto(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar. Tente novamente.", "erro");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  return (
    <>
      <form
        className="flex flex-col gap-[11px] p-0 w-full box-border"
        onSubmit={handleSubmit}
        data-figma="FormularioProduto"
        data-figma-hug="vertical"
      >
        {/* Descrição */}
        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Descrição do produto</label>
          <input
            className={INPUT_CLASS}
            name="descricao"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        {/* Unidade + Checkboxes */}
        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Unidade Padrão de Entrada</label>
          <div className="flex gap-2 items-center">
            <select
              className={`${INPUT_CLASS} flex-1`}
              name="id_conversao"
              value={idConversao ?? ""}
              onChange={(e) => setIdConversao(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione...</option>
              {conversoesAtuais.map((c) => (
                <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setUnidadesModalOpen(true)}
              title="Gerenciar unidades de conversão"
              className="flex items-center justify-center w-10 h-10 border border-border-input rounded-lg bg-white cursor-pointer text-brand shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {isEdit && (
            <div className="flex items-start justify-between gap-4">
              <label className={CHECKBOX_LABEL_CLASS}>
                <input
                    type="checkbox"
                    name="ativo"
                    checked={ativo}
                    disabled={!canDeactivate}
                    onChange={(e) => setAtivo(e.target.checked)}
                />
                Ativo
              </label>
            </div>
        )}

        {/* Flags + Data lado a lado */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-[5px]">
            <label className={CHECKBOX_LABEL_CLASS}>
              <input type="checkbox" name="perecivel" checked={perecivel} onChange={(e) => setPerecivel(e.target.checked)} />
              Perecível
            </label>
            <label className={CHECKBOX_LABEL_CLASS}>
              <input type="checkbox" name="composto" checked={composto} onChange={(e) => setComposto(e.target.checked)} />
              Composto
            </label>
          </div>
          {perecivel && (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Validade</label>
              <input
                className={INPUT_CLASS}
                type="date"
                name="data_validade"
                defaultValue={initialData?.data_validade ?? undefined}
              />
            </div>
          )}
        </div>

        {/* ── Códigos Personalizados ── */}
        <CodigosSection
          tiposCodigo={tiposCodigo}
          value={codigos}
          onChange={setCodigos}
        />

        {/* ── Insumos ── */}
        {composto && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-[590] tracking-[-0.028125rem] leading-[1.5625rem] text-ink-strong m-0">Insumos</h3>
              <Button
                label="Novo"
                iconLeft={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                }
                onClick={iniciarNovoInsumo}
              />
            </div>
            <DataTable columns={insumoColumns} data={insumos} actions={insumoActions} idField="descricao" pageSize={5} />
          </div>
        )}

        {/* Foto */}
        <FotoField initialFotoUrl={initialData?.foto_url} />

        {/* Actions */}
        <div className="flex justify-end gap-[10px] pt-1">
          <Button label="Cancelar" variant="cancel" onClick={onCancel} />
          <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
        </div>
      </form>

      <SearchEntityModal<ProdutoListRow>
        open={buscandoIdx !== null}
        onClose={() => { setBuscandoIdx(null); setEditandoIns(null); }}
        onSelect={onSelectInsumo}
        title="Selecionar Produto"
        columns={COLUNAS_PRODUTO}
        loadPage={listarProdutos}
        getItemId={(item) => item.id_produto}
        excludeIds={insumos.map((i) => i.id).filter((id) => id > 0)}
        placeholder="Filtrar produto por código ou descrição..."
      />

      <UnidadesModal
        open={unidadesModalOpen}
        onClose={() => setUnidadesModalOpen(false)}
        initial={conversoesAtuais}
        onChanged={(lista) => setConversoesAtuais(lista.map((u) => ({ id_conversao: u.id_conversao, nome: u.nome, fator: u.fator, descricao: u.descricao })))}
      />

      <Modal
        open={insumoViewData !== null}
        onClose={() => setInsumoViewData(null)}
        width="728px"
      >
        {insumoViewData && (
          <ProdutoView
            conversoes={conversoesAtuais}
            tiposCodigo={tiposCodigo}
            data={insumoViewData}
            onClose={() => setInsumoViewData(null)}
          />
        )}
      </Modal>
    </>
  );
}
