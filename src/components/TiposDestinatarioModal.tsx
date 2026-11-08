"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/Button";
import {
  listarTiposDestinatario,
  criarTipoDestinatario,
  atualizarTipoDestinatario,
  excluirTipoDestinatario,
} from "@/app/tipos-destinatario/actions";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import type { PermissoesEntidade, TipoDestinatarioItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: (tipos: TipoDestinatarioItem[]) => void;
  /** Lista inicial (vinda da página). */
  initial?: TipoDestinatarioItem[];
  /** Ações permitidas para o usuário (o servidor valida de novo). */
  perms?: Pick<PermissoesEntidade, "canCreate" | "canEdit" | "canDelete">;
}

const actionButtonCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)]";

const seloPadraoCls =
  "inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 font-sans text-xs font-semibold text-brand";

/** Coluna de ações da tabela — não é um dado do tipo. */
type TipoRow = TipoDestinatarioItem & { acoes?: string };

function TipoFormModal({
  tipo,
  onClose,
  onSaved,
}: {
  tipo: TipoDestinatarioItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [nome, setNome] = useState(tipo?.nome ?? "");
  const [padrao, setPadrao] = useState(tipo?.padrao ?? false);
  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();

  async function salvar() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("nome", nome);
      if (padrao) fd.set("padrao", "on");
      if (tipo) fd.set("id_tipo_destinatario", String(tipo.id_tipo_destinatario));
      const r = tipo ? await atualizarTipoDestinatario(fd) : await criarTipoDestinatario(fd);
      if ("error" in r) {
        mostrarAviso(r.error, "erro");
        return;
      }
      mostrarAviso(
        tipo ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.",
        "sucesso",
      );
      onClose();
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} width="440px">
      <div className={ui.form}>
        <div className={ui.field}>
          <label className={ui.label}>Nome</label>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Escola, Creche, CMEI..."
            className={ui.input}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-ink">
          <input
            type="checkbox"
            checked={padrao}
            onChange={(e) => setPadrao(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Tipo padrão (aplicado automaticamente ao novo destinatário)
        </label>

        <div className={ui.rowActions}>
          <Button label="Cancelar" variant="cancel" onClick={onClose} />
          <Button
            label={tipo ? "Salvar" : "Gravar"}
            variant="primary"
            onClick={salvar}
            disabled={saving || !nome.trim()}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function TiposDestinatarioModal({
  open,
  onClose,
  onChanged,
  initial = [],
  perms = { canCreate: false, canEdit: false, canDelete: false },
}: Props) {
  const [tipos, setTipos] = useState<TipoDestinatarioItem[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TipoDestinatarioItem | null>(null);
  const mostrarAviso = useAviso();

  const [deleteTarget, setDeleteTarget] = useState<TipoDestinatarioItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    const lista = await listarTiposDestinatario();
    setTipos(lista);
    onChanged?.(lista);
  }

  function iniciarNovo() {
    setEditando(null);
    setFormOpen(true);
  }

  function iniciarEdicao(tipo: TipoDestinatarioItem) {
    setEditando(tipo);
    setFormOpen(true);
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await excluirTipoDestinatario(deleteTarget.id_tipo_destinatario);
      if (r.error) {
        mostrarAviso(r.error, "erro");
        return;
      }
      mostrarAviso("Tipo excluído com sucesso.", "sucesso");
      setDeleteTarget(null);
      await carregar();
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<TipoRow>[] = [
    {
      key: "nome",
      label: "Nome",
      width: "2.2fr",
      align: "left",
      render: (value: TipoRow[keyof TipoRow], row: TipoRow) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{String(value ?? "")}</span>
          {row.padrao && <span className={seloPadraoCls}>Padrão</span>}
        </span>
      ),
    },
    {
      key: "total_destinatarios",
      label: "Destinatários",
      width: "0.9fr",
      align: "right",
      render: (_value, row) => String(row.total_destinatarios ?? 0),
    },
    {
      key: "acoes",
      label: "Ações",
      width: "0.9fr",
      align: "center",
      render: (_value, row) => (
        <span className="flex items-center justify-center gap-[0.625rem]">
          {perms.canEdit && (
            <button
              type="button"
              className={actionButtonCls}
              title="Editar"
              onClick={() => iniciarEdicao(row)}
            >
              <img src="/icons/actions/Editar.svg" alt="Editar" className="w-5 h-5" />
            </button>
          )}
          {perms.canDelete && (
            <button
              type="button"
              className={actionButtonCls}
              title="Excluir"
              onClick={() => setDeleteTarget(row)}
            >
              <img src="/icons/actions/Lixeira.svg" alt="Excluir" className="w-5 h-5" />
            </button>
          )}
        </span>
      ),
    },
  ];

  const avisosExclusao: string[] = [];
  if (deleteTarget?.padrao) {
    avisosExclusao.push("O cadastro ficará sem tipo padrão.");
  }
  if ((deleteTarget?.total_destinatarios ?? 0) > 0) {
    avisosExclusao.push(
      `${deleteTarget?.total_destinatarios} destinatário(s) ficarão sem tipo.`,
    );
  }
  const avisoExclusao = avisosExclusao.length
    ? ` ${avisosExclusao.join(" ")}`
    : "";

  return (
    <>
      <Modal open={open} onClose={onClose} width="720px">
        <div className={ui.form}>
          <div className="flex items-center justify-between">
            <h3 className="m-0 font-display text-xl font-[590] text-ink-strong">
              Tipos de escola
            </h3>
            {perms.canCreate && (
              <Button
                label="Novo"
                iconLeft={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 4V16M4 10H16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                onClick={iniciarNovo}
              />
            )}
          </div>

          <DataTable
            columns={columns}
            data={tipos as TipoRow[]}
            idField="id_tipo_destinatario"
            pageSize={6}
          />

          <div className="flex justify-end">
            <Button label="Fechar" variant="cancel" onClick={onClose} />
          </div>
        </div>
      </Modal>

      {formOpen && (
        <TipoFormModal
          tipo={editando}
          onClose={() => setFormOpen(false)}
          onSaved={carregar}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title="Excluir tipo de escola"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? A exclusão é permanente.${avisoExclusao}`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
