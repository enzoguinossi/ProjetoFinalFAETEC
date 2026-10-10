"use client";

import { useEffect, useRef, useState } from "react";
import { createProduto, updateProduto, getProduto, searchProdutos } from "../actions";
import type { ProdutoFormData } from "../actions";
import DataTable from "@/components/DataTable";
import SearchEntityModal from "@/components/SearchEntityModal";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import UnidadesModal from "@/components/UnidadesModal";
import Modal from "@/components/Modal";
import ProdutoView from "./ProdutoView";
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

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [fotoNome, setFotoNome] = useState("");

  useEffect(
    () => () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    },
    [previewFoto],
  );

  function onSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setPreviewFoto(null); setFotoNome(""); return; }
    setFotoNome(file.name);
    setPreviewFoto(URL.createObjectURL(file));
  }

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
      <form className="flex flex-col gap-[11px] p-0 w-full box-border" onSubmit={handleSubmit}>
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
            {insumos.map((ins, i) => (
              <div key={`hi-${i}`} className="hidden">
                <input name="insumo_produto" value={ins.id} readOnly />
                <input name="insumo_qtd" value={ins.qtd} readOnly />
              </div>
            ))}
          </div>
        )}

        {/* Foto */}
        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Foto</label>
          <div className="flex gap-2 items-center [&_input]:flex-1">
            <input
              className={INPUT_CLASS}
              name="foto_url"
              placeholder="URL da imagem..."
              defaultValue={initialData?.foto_url ?? undefined}
            />
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              name="foto_arquivo"
              className="hidden"
              onChange={onSelecionarFoto}
            />
            <button type="button" className="flex items-center justify-center w-10 h-10 border border-border-input rounded-lg bg-white cursor-pointer text-[#697077] shrink-0 transition-[background] duration-[120ms] hover:bg-hover" title="Upload" onClick={() => fotoInputRef.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2 2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>
          {fotoNome && (
            <span className="font-sans text-[0.8125rem] text-[#616161]">
              {fotoNome} — será convertida para WEBP ao salvar
            </span>
          )}
          {(previewFoto || initialData?.foto_url) && (
            <img
              src={previewFoto ?? initialData?.foto_url ?? ""}
              alt="Pré-visualização"
              className="mt-2 max-w-40 max-h-40 rounded-lg object-cover"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-[10px] pt-1">
          <Button label="Cancelar" variant="cancel" onClick={onCancel} />
          <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
        </div>
      </form>

      <SearchEntityModal
        open={buscandoIdx !== null}
        onClose={() => { setBuscandoIdx(null); setEditandoIns(null); }}
        onSelect={onSelectInsumo}
        searchAction={searchProdutos}
        getItemId={(item) => item.id_produto}
        getItemLabel={(item) => item.descricao}
        excludeIds={insumos.map((i) => i.id).filter((id) => id > 0)}
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
