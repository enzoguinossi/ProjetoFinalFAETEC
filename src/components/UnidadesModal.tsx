"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column, Action } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/Button";
import {
  listarUnidades,
  createUnidade,
  updateUnidade,
  deleteUnidade,
} from "@/app/unidades/actions";

export type UnidadeItem = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: (unidades: UnidadeItem[]) => void;
  /** Lista inicial de unidades (vinda da página). */
  initial?: UnidadeItem[];
}

const inputStyle = {
  height: 40, padding: "0 16px", border: "1px solid #d9d9d9",
  borderRadius: 8, fontFamily: "Inter,sans-serif", fontSize: "1rem",
  outline: "none", width: "100%", boxSizing: "border-box" as const,
};

const columns: Column<UnidadeItem>[] = [
  { key: "nome", label: "Nome", width: "1.5fr" },
  { key: "fator", label: "Fator", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "3fr" },
];

export default function UnidadesModal({ open, onClose, onChanged, initial = [] }: Props) {
  const [unidades, setUnidades] = useState<UnidadeItem[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<UnidadeItem | null>(null);
  const [nome, setNome] = useState("");
  const [fator, setFator] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UnidadeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function carregar() {
    const lista = await listarUnidades();
    setUnidades(lista);
    onChanged?.(lista);
  }

  function iniciarNovo() {
    setEditando(null); setNome(""); setFator(""); setDescricao(""); setErro("");
    setFormOpen(true);
  }

  function iniciarEdicao(u: UnidadeItem) {
    setEditando(u); setNome(u.nome); setFator(String(u.fator)); setDescricao(u.descricao ?? ""); setErro("");
    setFormOpen(true);
  }

  async function salvar() {
    setErro("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("nome", nome);
      fd.set("fator", fator);
      fd.set("descricao", descricao);
      if (editando) fd.set("id_conversao", String(editando.id_conversao));
      const r = editando ? await updateUnidade(fd) : await createUnidade(fd);
      if (r.error) { setErro(r.error); return; }
      setFormOpen(false);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError("");
    try {
      const r = await deleteUnidade(deleteTarget.id_conversao);
      if (r.error) { setDeleteError(r.error); return; }
      setDeleteTarget(null);
      await carregar();
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<UnidadeItem>[] = [
    { icon: "/icons/actions/Editar.svg", label: "Editar", onClick: iniciarEdicao },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row) => { setDeleteTarget(row); setDeleteError(""); } },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} width="640px">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontFamily: '"SF Pro","Segoe UI",sans-serif', fontSize: "1.25rem", fontWeight: 590, margin: 0, color: "#1e1e1e" }}>
              Unidades de Conversão
            </h3>
            <Button
              label="Nova"
              iconLeft={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
              onClick={iniciarNovo}
            />
          </div>

          <DataTable columns={columns} data={unidades} actions={actions} idField="id_conversao" pageSize={5} />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} width="440px">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {erro && <div style={{ padding: "0.5rem 0.75rem", background: "#fff1f0", border: "1px solid #da1e28", borderRadius: 6, color: "#da1e28", fontFamily: "Inter,sans-serif", fontSize: "0.8125rem" }}>{erro}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Nome</label>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="CX20, PCT10, UN..." style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Fator</label>
            <input type="number" min="0" step="any" value={fator} onChange={(e) => setFator(e.target.value)} placeholder="20" style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: "Inter,sans-serif", fontSize: "1rem", color: "#1e1e1e" }}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <Button label="Cancelar" variant="cancel" onClick={() => setFormOpen(false)} />
            <Button label={editando ? "Salvar" : "Gravar"} variant="primary" onClick={salvar} disabled={saving || !nome.trim() || !fator} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={confirmarExclusao}
        title="Excluir unidade"
        message={deleteError || `Tem certeza que deseja excluir "${deleteTarget?.nome}"? Produtos que a usam como padrão serão desvinculados.`}
        confirmLabel={deleteError ? "OK" : "Excluir"}
        loading={deleting}
      />
    </>
  );
}
