"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduto } from "./actions";
import BuscarProduto from "@/components/BuscarProduto";
import styles from "./ProdutoForm.module.css";

interface Conversao {
  id_conversao: number;
  nome: string;
}

interface TipoCodigo {
  id_tipo_codigo: number;
  nome: string;
}

interface ProdutoItem {
  id_produto: number;
  descricao: string;
}

interface Props {
  conversoes: Conversao[];
  tiposCodigo: TipoCodigo[];
  produtos: ProdutoItem[];
}

type CodigoEntry = { tipo: string; valor: string };
type InsumoEntry = { id: number; descricao: string; qtd: string };

export default function ProdutoForm({ conversoes, tiposCodigo }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [perecivel, setPerecivel] = useState(false);
  const [composto, setComposto] = useState(false);

  // Códigos personalizados
  const [codigos, setCodigos] = useState<CodigoEntry[]>([
    { tipo: "DIGITACAO", valor: "" },
  ]);

  // Insumos
  const [insumos, setInsumos] = useState<InsumoEntry[]>([]);
  const [buscandoIdx, setBuscandoIdx] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const form = new FormData(e.currentTarget);
      const result = await createProduto(form);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/produtos");
      }
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function addCodigo() {
    setCodigos([...codigos, { tipo: "DIGITACAO", valor: "" }]);
  }

  function updateCodigo(i: number, field: keyof CodigoEntry, value: string) {
    const next = [...codigos];
    next[i] = { ...next[i], [field]: value };
    setCodigos(next);
  }

  function removeCodigo(i: number) {
    setCodigos(codigos.filter((_, idx) => idx !== i));
  }

  function addInsumo() {
    const idx = insumos.length;
    setInsumos([...insumos, { id: 0, descricao: "", qtd: "1" }]);
    setBuscandoIdx(idx);
  }

  function updateInsumoQtd(i: number, qtd: string) {
    const next = [...insumos];
    next[i] = { ...next[i], qtd };
    setInsumos(next);
  }

  function removeInsumo(i: number) {
    setInsumos(insumos.filter((_, idx) => idx !== i));
  }

  function onSelectInsumo(prod: ProdutoItem) {
    if (buscandoIdx === null) return;
    const next = [...insumos];
    next[buscandoIdx] = { ...next[buscandoIdx], id: prod.id_produto, descricao: prod.descricao };
    setInsumos(next);
    setBuscandoIdx(null);
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Descrição */}
        <div className={styles.field}>
          <label className={styles.label}>Descrição</label>
          <input className={styles.input} name="descricao" required />
        </div>

        {/* Unidade + Checkboxes */}
        <div className={styles.field}>
          <label className={styles.label}>Unidade Padrão</label>
          <select className={styles.select} name="id_conversao">
            <option value="">Selecione...</option>
            {conversoes.map((c) => (
              <option key={c.id_conversao} value={c.id_conversao}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="perecivel"
              checked={perecivel}
              onChange={(e) => setPerecivel(e.target.checked)}
            />
            Perecível
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="composto"
              checked={composto}
              onChange={(e) => setComposto(e.target.checked)}
            />
            Composto
          </label>
        </div>

        {/* Data de validade (condicional) */}
        {perecivel && (
          <div className={styles.conditional}>
            <div className={styles.field}>
              <label className={styles.label}>Data de Validade</label>
              <input className={styles.input} type="date" name="data_validade" />
            </div>
          </div>
        )}

        {/* Insumos / BOM (condicional) */}
        {composto && (
          <div className={styles.conditional}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Produtos Compostos (Insumos)</h3>
              {insumos.map((ins, i) => (
                <div key={i} className={styles.insumoRow}>
                  <div className={styles.insumoField}>
                    <input
                      className={styles.input}
                      name={`insumo_produto`}
                      value={ins.descricao}
                      placeholder="Selecione um produto..."
                      readOnly
                    />
                    <input type="hidden" name={`insumo_produto`} value={ins.id} />
                    <button
                      type="button"
                      className={styles.locateBtn}
                      onClick={() => setBuscandoIdx(i)}
                      title="Buscar produto"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                    </button>
                  </div>
                  <input
                    className={`${styles.input} ${styles.insumoQtd}`}
                    name={`insumo_qtd`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ins.qtd}
                    onChange={(e) => updateInsumoQtd(i, e.target.value)}
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeInsumo(i)}
                    title="Remover"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
              <button type="button" className={styles.addBtn} onClick={addInsumo}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Adicionar insumo
              </button>
            </div>
          </div>
        )}

        {/* Códigos Personalizados */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Códigos Personalizados</h3>
          {codigos.map((c, i) => (
            <div key={i} className={styles.codeRow}>
              <select
                className={`${styles.select} ${styles.codeSelect}`}
                name="codigo_tipo"
                value={c.tipo}
                onChange={(e) => updateCodigo(i, "tipo", e.target.value)}
              >
                {tiposCodigo.map((t) => (
                  <option key={t.id_tipo_codigo} value={t.nome}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <input
                className={`${styles.input} ${styles.codeInput}`}
                name="codigo_valor"
                placeholder="Valor do código"
                value={c.valor}
                onChange={(e) => updateCodigo(i, "valor", e.target.value)}
              />
              {codigos.length > 1 && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeCodigo(i)}
                  title="Remover código"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={addCodigo}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Adicionar código
          </button>
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

        {/* Ações */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.back()}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      <BuscarProduto
        open={buscandoIdx !== null}
        onClose={() => setBuscandoIdx(null)}
        onSelect={onSelectInsumo}
        excludeIds={insumos.map((i) => i.id).filter((id) => id > 0)}
      />
    </>
  );
}