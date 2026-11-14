"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";
import type { PermissoesEntidade } from "@/types";

/** Item genérico dos cadastros de tipo (destinatário, produto). */
export type TipoCadastroItem = {
  id: number;
  codigo: string;
  nome: string;
  padrao: boolean;
  /** Quantidade de registros vinculados (exibida na tabela). */
  total?: number;
};

/** Resultado das actions do servidor (`{ success }` ou `{ error }`). */
type ResultadoAcao = { error?: string; success?: boolean };

export interface TiposCadastroModalProps {
  open: boolean;
  onClose: () => void;
  onChanged?: (tipos: TipoCadastroItem[]) => void;
  /** Lista inicial (vinda da página). */
  initial?: TipoCadastroItem[];
  /** Ações permitidas para o usuário (o servidor valida de novo). */
  perms?: Pick<PermissoesEntidade, "canCreate" | "canEdit" | "canDelete">;
  /** Título do modal (ex.: "Tipos de escola"). */
  titulo: string;
  /** Descrição do item nas mensagens (ex.: "tipo de escola"). */
  descricaoItem: string;
  /** Placeholder do nome. */
  placeholder: string;
  /** Rótulo da coluna de vínculos (ex.: "Destinatários"). */
  rotuloTotal: string;
  /** Texto do checkbox de padrão. */
  rotuloPadrao: string;
  /** Nome do campo enviado com o id (ex.: `id_tipo_destinatario`). */
  campoId: string;
  listar: () => Promise<TipoCadastroItem[]>;
  criar: (formData: FormData) => Promise<ResultadoAcao>;
  atualizar: (formData: FormData) => Promise<ResultadoAcao>;
  excluir: (id: number) => Promise<ResultadoAcao>;
}

const actionButtonCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)]";

const seloPadraoCls =
  "inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 font-sans text-xs font-semibold text-brand";

/** Coluna de ações da tabela — não é um dado do tipo. */
type TipoRow = TipoCadastroItem & { acoes?: string };

function TipoFormModal({
  tipo,
  campoId,
  placeholder,
  rotuloPadrao,
  onClose,
  onSaved,
  criar,
  atualizar,
}: {
  tipo: TipoCadastroItem | null;
  campoId: string;
  placeholder: string;
  rotuloPadrao: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  criar: (formData: FormData) => Promise<ResultadoAcao>;
  atualizar: (formData: FormData) => Promise<ResultadoAcao>;
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
      if (tipo) fd.set(campoId, String(tipo.id));
      const r = tipo ? await atualizar(fd) : await criar(fd);
      if (r.error) {
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
            placeholder={placeholder}
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
          {rotuloPadrao}
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

export default function TiposCadastroModal({
  open,
  onClose,
  onChanged,
  initial = [],
  perms = { canCreate: false, canEdit: false, canDelete: false },
  titulo,
  descricaoItem,
  placeholder,
  rotuloTotal,
  rotuloPadrao,
  campoId,
  listar,
  criar,
  atualizar,
  excluir,
}: TiposCadastroModalProps) {
  const [tipos, setTipos] = useState<TipoCadastroItem[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TipoCadastroItem | null>(null);
  const mostrarAviso = useAviso();

  const [deleteTarget, setDeleteTarget] = useState<TipoCadastroItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    const lista = await listar();
    setTipos(lista);
    onChanged?.(lista);
  }

  function iniciarNovo() {
    setEditando(null);
    setFormOpen(true);
  }

  function iniciarEdicao(tipo: TipoCadastroItem) {
    setEditando(tipo);
    setFormOpen(true);
  }

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await excluir(deleteTarget.id);
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
      key: "total",
      label: rotuloTotal,
      width: "0.9fr",
      align: "right",
      render: (_value, row) => String(row.total ?? 0),
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
  if ((deleteTarget?.total ?? 0) > 0) {
    // "Destinatários" → "destinatário", "Produtos" → "produto".
    const afetado = rotuloTotal.toLowerCase().replace(/s$/, "");
    avisosExclusao.push(`${deleteTarget?.total} ${afetado}(s) ficarão sem tipo.`);
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
              {titulo}
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
            idField="id"
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
          campoId={campoId}
          placeholder={placeholder}
          rotuloPadrao={rotuloPadrao}
          onClose={() => setFormOpen(false)}
          onSaved={carregar}
          criar={criar}
          atualizar={atualizar}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
        title={`Excluir ${descricaoItem}`}
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? A exclusão é permanente.${avisoExclusao}`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
