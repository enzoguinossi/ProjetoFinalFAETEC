"use client";

import { useRef, useState } from "react";
import { createProduto, updateProduto, getProduto, searchProdutos } from "./actions";
import type { ProdutoFormData } from "./actions";
import DataTable from "@/components/DataTable";
import SearchEntityModal from "@/components/SearchEntityModal";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import UnidadesModal from "@/components/UnidadesModal";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import styles from "./ProdutoForm.module.css";

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
  mode?: "create" | "edit" | "view";
  initialData?: ProdutoFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type InsumoEntry = { id: number; descricao: string; qtd: string };

export default function ProdutoForm({
  conversoes, tiposCodigo, mode = "create", initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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

  const [insumoViewOpen, setInsumoViewOpen] = useState(false);
  const [insumoViewData, setInsumoViewData] = useState<ProdutoFormData | null>(null);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [fotoNome, setFotoNome] = useState("");

  function onSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setPreviewFoto(null); setFotoNome(""); return; }
    setFotoNome(file.name);
    setPreviewFoto(URL.createObjectURL(file));
  }

  const editable = !isView;

  const insumoColumns: import("@/components/DataTable").Column<InsumoEntry>[] = [
    { key: "descricao", label: "Produto", width: "3fr" },
    {
      key: "qtd", label: "Quantidade", width: "1fr",
      render: editable ? (value: string | number, row: InsumoEntry) => (
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
          style={{
            width: "100%", height: 28, border: "1px solid #d9d9d9", borderRadius: 6,
            padding: "0 8px", fontFamily: "Inter,sans-serif", fontSize: "0.875rem",
            outline: "none", boxSizing: "border-box",
          }}
        />
      ) : undefined,
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

  async function visualizarInsumo(id_produto: number) {
    const data = await getProduto(id_produto);
    if (data) {
      setInsumoViewData(data);
      setInsumoViewOpen(true);
    }
  }

  const insumoActions = [
    {
      icon: "/icons/actions/Olho.svg",
      label: "Visualizar",
      onClick: (row: Record<string, unknown>) => {
        const i = insumos.findIndex((ins) => ins.descricao === row.descricao);
        if (i >= 0 && insumos[i].id > 0) visualizarInsumo(insumos[i].id);
      },
    },
    ...(editable ? [{
      icon: "/icons/actions/Lixeira.svg",
      label: "Excluir",
      onClick: (row: Record<string, unknown>) => {
        const i = insumos.findIndex((ins) => ins.descricao === row.descricao);
        if (i >= 0) removerInsumo(i);
      },
    }] : []),
  ];

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_produto", String(initialData.id_produto));
      const result = initialData
        ? await updateProduto(form)
        : await createProduto(form);
      if (result.error) setError(result.error);
      else onSuccess?.();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}



        {/* Descrição */}
        <div className={styles.field}>
          <label className={styles.label}>Descrição do produto</label>
          <input
            className={styles.input}
            name="descricao"
            required={!isView}
            value={isView || isEdit ? descricao : undefined}
            onChange={isEdit ? (e) => setDescricao(e.target.value) : undefined}
            readOnly={isView}
            tabIndex={isView ? -1 : 0}
          />
        </div>

        {/* Unidade + Checkboxes */}
        <div className={styles.field}>
          <label className={styles.label}>Unidade Padrão de Entrada</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className={styles.select}
              name="id_conversao"
              value={idConversao ?? ""}
              onChange={(e) => setIdConversao(e.target.value ? Number(e.target.value) : null)}
              disabled={isView}
              style={{ flex: 1 }}
            >
              <option value="">Selecione...</option>
              {conversoesAtuais.map((c) => (
                <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
              ))}
            </select>
            {!isView && (
              <button
                type="button"
                onClick={() => setUnidadesModalOpen(true)}
                title="Gerenciar unidades de conversão"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 40, height: 40, border: "1px solid #d9d9d9", borderRadius: 8,
                  background: "#fff", cursor: "pointer", color: "#1b9956", flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {isEdit && (
            <div className={styles.flagsRow}>
              <label className={styles.checkboxLabel}>
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
        <div className={styles.flagsRow}>
          <div className={styles.checkboxCol}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" name="perecivel" checked={perecivel} onChange={(e) => setPerecivel(e.target.checked)} disabled={isView} />
              Perecível
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" name="composto" checked={composto} onChange={(e) => setComposto(e.target.checked)} disabled={isView} />
              Composto
            </label>
          </div>
          {perecivel && (
            <div className={styles.dateCol}>
              <label className={styles.label}>Validade</label>
              <input
                className={styles.input}
                type="date"
                name="data_validade"
                defaultValue={initialData?.data_validade ?? undefined}
                readOnly={isView}
              />
            </div>
          )}
        </div>

        {/* ── Códigos Personalizados ── */}
        <CodigosSection
          tiposCodigo={tiposCodigo}
          value={codigos}
          onChange={setCodigos}
          disabled={isView}
        />

        {/* ── Insumos ── */}
        {composto && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Insumos</h3>
              {!isView && (
                <Button
                  label="Novo"
                  iconLeft={
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={iniciarNovoInsumo}
                />
              )}
            </div>
            <DataTable columns={insumoColumns} data={insumos} actions={insumoActions} idField="descricao" pageSize={5} />
            {insumos.map((ins, i) => (
              <div key={`hi-${i}`} style={{ display: "none" }}>
                <input name="insumo_produto" value={ins.id} readOnly />
                <input name="insumo_qtd" value={ins.qtd} readOnly />
              </div>
            ))}
          </div>
        )}

        {/* Foto */}
        <div className={styles.field}>
          <label className={styles.label}>Foto</label>
          <div className={styles.fotoRow}>
            <input
              className={styles.input}
              name="foto_url"
              placeholder="URL da imagem..."
              defaultValue={initialData?.foto_url ?? undefined}
              readOnly={isView}
            />
            {!isView && (
              <>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  name="foto_arquivo"
                  style={{ display: "none" }}
                  onChange={onSelecionarFoto}
                />
                <button type="button" className={styles.fotoBtn} title="Upload" onClick={() => fotoInputRef.current?.click()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2 2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {fotoNome && (
            <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#616161" }}>
              {fotoNome} — será convertida para WEBP ao salvar
            </span>
          )}
          {(previewFoto || initialData?.foto_url) && (
            <img
              src={previewFoto ?? initialData?.foto_url ?? ""}
              alt="Pré-visualização"
              style={{ marginTop: 8, maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: "cover" }}
            />
          )}
        </div>

        {/* Actions */}
        {!isView && (
          <div className={styles.actions}>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
          </div>
        )}
        {isView && (
          <div className={styles.actions}>
            <Button label="Fechar" variant="cancel" onClick={onCancel} />
          </div>
        )}
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
        open={insumoViewOpen && insumoViewData !== null}
        onClose={() => { setInsumoViewOpen(false); setInsumoViewData(null); }}
        width="728px"
      >
        {insumoViewData && (
          <ProdutoForm
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            mode="view"
            initialData={insumoViewData}
            onCancel={() => { setInsumoViewOpen(false); setInsumoViewData(null); }}
          />
        )}
      </Modal>
    </>
  );
}