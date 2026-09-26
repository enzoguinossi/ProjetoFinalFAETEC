"use client";

import { useState } from "react";
import { createProduto } from "./actions";
import DataTable from "@/components/DataTable";
import BuscarProduto from "@/components/BuscarProduto";
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

export default function ProdutoForm({ conversoes, tiposCodigo, onSuccess, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [perecivel, setPerecivel] = useState(false);
  const [composto, setComposto] = useState(false);

  const [codigos, setCodigos] = useState<CodigoEntry[]>([]);
  const [editandoCod, setEditandoCod] = useState<number | null>(null);
  const [novoTipo, setNovoTipo] = useState("DIGITACAO");
  const [novoValor, setNovoValor] = useState("");

  const [insumos, setInsumos] = useState<InsumoEntry[]>([]);
  const [editandoIns, setEditandoIns] = useState<number | null>(null);
  const [buscandoIdx, setBuscandoIdx] = useState<number | null>(null);

  // ── Códigos ──

  function iniciarNovoCodigo() {
    setNovoTipo("DIGITACAO");
    setNovoValor("");
    setEditandoCod(codigos.length);
  }

  function confirmarCodigo() {
    if (!novoValor.trim()) return;
    const next = [...codigos];
    if (editandoCod !== null && editandoCod < codigos.length) {
      next[editandoCod] = { tipo: novoTipo, valor: novoValor };
    } else {
      next.push({ tipo: novoTipo, valor: novoValor });
    }
    setCodigos(next);
    setEditandoCod(null);
    setNovoValor("");
  }

  function editarCodigo(i: number) {
    setNovoTipo(codigos[i].tipo);
    setNovoValor(codigos[i].valor);
    setEditandoCod(i);
  }

  function removerCodigo(i: number) {
    setCodigos(codigos.filter((_, idx) => idx !== i));
    if (editandoCod === i) setEditandoCod(null);
  }

  const codigoActions = [
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

  const insumoActions = [
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
    setError("");
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await createProduto(form);
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
          <input className={styles.input} name="descricao" required />
        </div>

        {/* Unidade + Checkboxes */}
        <div className={styles.field}>
          <label className={styles.label}>Unidade Padrão</label>
          <select className={styles.select} name="id_conversao">
            <option value="">Selecione...</option>
            {conversoes.map((c) => (
              <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" name="perecivel" checked={perecivel} onChange={(e) => setPerecivel(e.target.checked)} />
            Perecível
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" name="composto" checked={composto} onChange={(e) => setComposto(e.target.checked)} />
            Composto
          </label>
        </div>

        {perecivel && (
          <div className={styles.field}>
            <label className={styles.label}>Validade</label>
            <input className={styles.input} type="date" name="data_validade" />
          </div>
        )}

        {/* ── Insumos ── */}
        {composto && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Insumos</h3>
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
            {/* hidden inputs for insumos */}
            {insumos.map((ins, i) => (
              <div key={`hi-${i}`} style={{ display: "none" }}>
                <input name="insumo_produto" value={ins.id} readOnly />
                <input name="insumo_qtd" value={ins.qtd} readOnly />
              </div>
            ))}
          </div>
        )}

        {/* ── Códigos Personalizados ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Códigos Personalizados</h3>
            <Button
                          label="Novo"
                          iconLeft={
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          }
                          onClick={iniciarNovoCodigo}
                        />
          </div>

          {/* Inline editor for current code */}
          {editandoCod !== null && (
            <div className={styles.inlineEditor}>
              <select
                className={`${styles.select} ${styles.codeSelect}`}
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
              >
                {tiposCodigo.map((t) => (
                  <option key={t.id_tipo_codigo} value={t.nome}>{t.nome}</option>
                ))}
              </select>
              <input
                className={styles.input}
                placeholder="Valor do código"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
              />
              <button type="button" className={styles.confirmBtn} onClick={confirmarCodigo} disabled={!novoValor.trim()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className={styles.cancelSmallBtn} onClick={() => setEditandoCod(null)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <DataTable columns={codigoColumns} data={codigos} actions={codigoActions} idField="valor" pageSize={5} />

          {/* hidden inputs for submit */}
          {codigos.map((c, i) => (
            <div key={`hc-${i}`} style={{ display: "none" }}>
              <input name="codigo_tipo" value={c.tipo} readOnly />
              <input name="codigo_valor" value={c.valor} readOnly />
            </div>
          ))}
        </div>

        {/* Foto */}
        <div className={styles.field}>
          <label className={styles.label}>Foto</label>
          <div className={styles.fotoRow}>
            <input className={styles.input} name="foto_url" placeholder="URL da imagem..." />
            <button type="button" className={styles.fotoBtn} title="Upload">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Button label="Cancelar" variant="cancel" onClick={onCancel} />
          <Button label="Gravar" variant="primary" type="submit" disabled={saving} />
        </div>
      </form>

      <BuscarProduto
        open={buscandoIdx !== null}
        onClose={() => { setBuscandoIdx(null); setEditandoIns(null); }}
        onSelect={onSelectInsumo}
        excludeIds={insumos.map((i) => i.id).filter((id) => id > 0)}
      />
    </>
  );
}