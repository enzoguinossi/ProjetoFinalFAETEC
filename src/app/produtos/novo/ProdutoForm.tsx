"use client";

import { useEffect, useState } from "react";
import { createProduto, updateProduto, searchProdutos } from "./actions";
import type { ProdutoFormData } from "./actions";
import DataTable from "@/components/DataTable";
import SearchEntityModal from "@/components/SearchEntityModal";
import CodigoForm from "@/components/CodigoForm";
import Button from "@/components/Button";
import styles from "./ProdutoForm.module.css";

interface Conversao {
  id_conversao: number;
  nome: string;
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
  onSuccess?: () => void;
  onCancel?: () => void;
}

type CodigoEntry = { tipo: string; valor: string };
type InsumoEntry = { id: number; descricao: string; qtd: string };

const codigoColumns = [
  { key: "tipo" as const, label: "Tipo", width: "1.5fr" },
  { key: "valor" as const, label: "Código", width: "2fr" },
];

const insumoColumns = [
  { key: "descricao" as const, label: "Produto", width: "3fr" },
  { key: "qtd" as const, label: "Quantidade", width: "1fr" },
];

export default function ProdutoForm({
  conversoes, tiposCodigo, mode = "create", initialData,
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

  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);
  const [codigoModalOpen, setCodigoModalOpen] = useState(false);
  const [codigoEditandoIdx, setCodigoEditandoIdx] = useState<number | null>(null);

  const [insumos, setInsumos] = useState<InsumoEntry[]>(
    initialData?.insumos.map((i) => ({ id: i.id, descricao: i.descricao, qtd: String(i.qtd) })) ?? [],
  );
  const [editandoIns, setEditandoIns] = useState<number | null>(null);
  const [buscandoIdx, setBuscandoIdx] = useState<number | null>(null);

  // ── Códigos ──

  function iniciarNovoCodigo() {
    setCodigoEditandoIdx(null);
    setCodigoModalOpen(true);
  }

  function confirmarCodigo(tipo: string, valor: string) {
    if (codigoEditandoIdx !== null && codigoEditandoIdx < codigos.length) {
      const next = [...codigos];
      next[codigoEditandoIdx] = { tipo, valor };
      setCodigos(next);
    } else {
      setCodigos([...codigos, { tipo, valor }]);
    }
    setCodigoModalOpen(false);
  }

  function editarCodigo(i: number) {
    setCodigoEditandoIdx(i);
    setCodigoModalOpen(true);
  }

  function removerCodigo(i: number) {
    setCodigos(codigos.filter((_, idx) => idx !== i));
  }

  const codigoActions = isView ? undefined : [
    {
      icon: "/icons/actions/Editar.svg",
      label: "Editar",
      onClick: (row: Record<string, unknown>) => {
        const i = codigos.findIndex((c) => c.valor === row.valor && c.tipo === row.tipo);
        if (i >= 0) editarCodigo(i);
      },
    },
    {
      icon: "/icons/actions/Lixeira.svg",
      label: "Excluir",
      onClick: (row: Record<string, unknown>) => {
        const i = codigos.findIndex((c) => c.valor === row.valor && c.tipo === row.tipo);
        if (i >= 0) removerCodigo(i);
      },
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

  const insumoActions = isView ? undefined : [
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
          <select
            className={styles.select}
            name="id_conversao"
            value={idConversao ?? ""}
            onChange={isEdit ? (e) => setIdConversao(e.target.value ? Number(e.target.value) : null) : undefined}
            disabled={isView}
          >
            <option value="">Selecione...</option>
            {conversoes.map((c) => (
              <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
            ))}
          </select>
        </div>

        {isEdit && (
            <div className={styles.flagsRow}>
              <label className={styles.checkboxLabel}>
                <input
                    type="checkbox"
                    name="ativo"
                    checked={ativo}
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
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Códigos Personalizados</h3>
            {!isView && (
              <Button
                label="Novo"
                iconLeft={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                }
                onClick={iniciarNovoCodigo}
              />
            )}
          </div>

          <DataTable columns={codigoColumns} data={codigos} actions={codigoActions} idField="valor" pageSize={5} />

          {codigos.map((c, i) => (
            <div key={`hc-${i}`} style={{ display: "none" }}>
              <input name="codigo_tipo" value={c.tipo} readOnly />
              <input name="codigo_valor" value={c.valor} readOnly />
            </div>
          ))}
        </div>

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
              <button type="button" className={styles.fotoBtn} title="Upload">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            )}
          </div>
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

      <CodigoForm
        open={codigoModalOpen}
        onClose={() => setCodigoModalOpen(false)}
        onConfirm={confirmarCodigo}
        tiposCodigo={tiposCodigo}
        initialTipo={codigoEditandoIdx !== null ? codigos[codigoEditandoIdx]?.tipo : "DIGITACAO"}
        initialValor={codigoEditandoIdx !== null ? codigos[codigoEditandoIdx]?.valor : ""}
        editing={codigoEditandoIdx !== null}
      />
    </>
  );
}