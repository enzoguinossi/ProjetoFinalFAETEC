"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
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
  padrao: boolean;
  /** Coluna de ações da tabela — não é um dado da unidade. */
  acoes?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: (unidades: UnidadeItem[]) => void;
  /** Lista inicial de unidades (vinda da página). */
  initial?: UnidadeItem[];
}

const actionButtonCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)]";

const seloPadraoCls =
  "inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 font-sans text-xs font-semibold text-brand";

function UnidadeFormModal({
  unidade,
  onClose,
  onSaved,
}: {
  unidade: UnidadeItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ehPadrao = unidade?.padrao ?? false;
  const [nome, setNome] = useState(unidade?.nome ?? "");
  const [fator, setFator] = useState(unidade ? String(unidade.fator) : "");
  const [descricao, setDescricao] = useState(unidade?.descricao ?? "");
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();

  async function salvar() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("nome", nome);
      fd.set("fator", fator);
      fd.set("descricao", descricao);
      if (unidade) fd.set("id_conversao", String(unidade.id_conversao));
      const r = unidade ? await updateUnidade(fd) : await createUnidade(fd);
      if (r.error) { mostrarAviso(r.error, "erro"); return; }
      mostrarAviso(unidade ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onClose();
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} width="440px">
      <div className={ui.form}>
        {ehPadrao && (
          <p className="m-0 font-sans text-sm text-[#697077]">
            Unidade padrão do sistema: nome e fator não podem ser alterados.
            Apenas a descrição é editável.
          </p>
        )}

        <div className={ui.field}>
          <label className={ui.label}>Nome</label>
          <input autoFocus={!ehPadrao} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="UNIDADE, PACOTE, CAIXA..." disabled={ehPadrao} className={ui.input} />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Fator</label>
          <input type="number" min="0" step="any" value={fator} onChange={(e) => setFator(e.target.value)} placeholder="10" disabled={ehPadrao} className={ui.input} />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" className={ui.input} />
        </div>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={onClose} />
          <Button
            label={unidade ? "Salvar" : "Gravar"}
            variant="primary"
            onClick={salvar}
            disabled={saving || !nome.trim() || !fator}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function UnidadesModal({ open, onClose, onChanged, initial = [] }: Props) {
  const [unidades, setUnidades] = useState<UnidadeItem[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<UnidadeItem | null>(null);
  const mostrarAviso = useAviso();

  const [deleteTarget, setDeleteTarget] = useState<UnidadeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    const lista = await listarUnidades();
    setUnidades(lista);
    onChanged?.(lista);
  }

  function iniciarNovo() {
    setEditando(null);
    setFormOpen(true);
  }

  function iniciarEdicao(u: UnidadeItem) {
    setEditando(u);
    setFormOpen(true);
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

  const columns: Column<UnidadeItem>[] = [
    {
      key: "nome", label: "Nome", width: "1.4fr", align: "left",
      render: (value: UnidadeItem[keyof UnidadeItem], row: UnidadeItem) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{String(value ?? "")}</span>
          {row.padrao && <span className={seloPadraoCls}>Padrão</span>}
        </span>
      ),
    },
    { key: "fator", label: "Fator", width: "0.7fr", align: "right" },
    { key: "descricao", label: "Descrição", width: "2.5fr", align: "left" },
    {
      key: "acoes", label: "Ações", width: "0.9fr", align: "center",
      render: (_value: UnidadeItem[keyof UnidadeItem], row: UnidadeItem) => (
        <span className="flex items-center justify-center gap-[0.625rem]">
          <button
            type="button"
            className={actionButtonCls}
            title="Editar"
            onClick={() => iniciarEdicao(row)}
          >
            <img src="/icons/actions/Editar.svg" alt="Editar" className="w-5 h-5" />
          </button>
          {!row.padrao && (
            <button
              type="button"
              className={actionButtonCls}
              title="Excluir"
              onClick={() => { setDeleteTarget(row); }}
            >
              <img src="/icons/actions/Lixeira.svg" alt="Excluir" className="w-5 h-5" />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} width="720px">
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

          <DataTable columns={columns} data={unidades} idField="id_conversao" pageSize={5} />

          <div className="flex justify-end">
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      </Modal>

      {formOpen && (
        <UnidadeFormModal
          unidade={editando}
          onClose={() => setFormOpen(false)}
          onSaved={carregar}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir unidade"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? A exclusão é permanente. Os produtos que usam esta unidade serão vinculados à unidade padrão.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
