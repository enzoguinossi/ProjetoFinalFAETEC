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
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

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
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();

  const [deleteTarget, setDeleteTarget] = useState<UnidadeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    const lista = await listarUnidades();
    setUnidades(lista);
    onChanged?.(lista);
  }

  function iniciarNovo() {
    setEditando(null); setNome(""); setFator(""); setDescricao("");
    setFormOpen(true);
  }

  function iniciarEdicao(u: UnidadeItem) {
    setEditando(u); setNome(u.nome); setFator(String(u.fator)); setDescricao(u.descricao ?? "");
    setFormOpen(true);
  }

  async function salvar() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("nome", nome);
      fd.set("fator", fator);
      fd.set("descricao", descricao);
      if (editando) fd.set("id_conversao", String(editando.id_conversao));
      const r = editando ? await updateUnidade(fd) : await createUnidade(fd);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso(editando ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      setFormOpen(false);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await deleteUnidade(deleteTarget.id_conversao);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso("Unidade excluída com sucesso.", "sucesso");
      setDeleteTarget(null);
      await carregar();
    } finally {
      setDeleting(false);
    }
  }

  const actions: Action<UnidadeItem>[] = [
    { icon: "/icons/actions/Editar.svg", label: "Editar", onClick: iniciarEdicao },
    { icon: "/icons/actions/Lixeira.svg", label: "Excluir", onClick: (row) => { setDeleteTarget(row); } },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} width="640px">
        <div className={ui.form}>
          <div className="flex items-center justify-between">
            <h3 className="m-0 font-display text-xl font-[590] text-ink-strong">
              Unidades de Conversão
            </h3>
            <Button
              label="Nova"
              iconLeft={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
              onClick={iniciarNovo}
            />
          </div>

          <DataTable columns={columns} data={unidades} actions={actions} idField="id_conversao" pageSize={5} />

          <div className="flex justify-end">
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} width="440px">
        <div className={ui.form}>
          <div className={ui.field}>
            <label className={ui.label}>Nome</label>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="CX20, PCT10, UN..." className={ui.input} />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Fator</label>
            <input type="number" min="0" step="any" value={fator} onChange={(e) => setFator(e.target.value)} placeholder="20" className={ui.input} />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" className={ui.input} />
          </div>

          <div className={ui.rowActions}>
            <Button label="Cancelar" variant="cancel" onClick={() => setFormOpen(false)} />
            <Button label={editando ? "Salvar" : "Gravar"} variant="primary" onClick={salvar} disabled={saving || !nome.trim() || !fator} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir unidade"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Produtos que a usam como padrão serão desvinculados.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
