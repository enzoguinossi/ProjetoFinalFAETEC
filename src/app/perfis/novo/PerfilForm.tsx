"use client";

import { useState } from "react";
import { createPerfil, updatePerfil } from "../actions";
import type { PerfilFormData } from "../actions";
import Button from "@/components/Button";
import PermissoesPanel, { type GrupoPermissoes } from "@/components/PermissoesPanel";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface Props {
  grupos: GrupoPermissoes[];
  mode?: "create" | "edit" | "view";
  initialData?: PerfilFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PerfilForm({
  grupos, mode = "create", initialData, onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [selecionadas, setSelecionadas] = useState<string[]>(initialData?.permissoes ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      form.set("permissoes", JSON.stringify(selecionadas));
      if (initialData) form.set("id_perfil", String(initialData.id_perfil));
      const result = initialData ? await updatePerfil(form) : await createPerfil(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <div className="grid grid-cols-[320px_1fr] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <div className={ui.field}>
            <label className={ui.label}>Nome</label>
            <input name="nome" required={!isView} value={isView || isEdit ? nome : undefined}
              onChange={isEdit ? (e) => setNome(e.target.value) : undefined} readOnly={isView} className={ui.input} />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Descrição</label>
            {isView ? (
              <p className={`${ui.input} leading-[2.5] m-0`}>{initialData?.descricao ?? "—"}</p>
            ) : (
              <input
                name="descricao"
                value={isEdit ? descricao : undefined}
                defaultValue={isEdit ? undefined : (initialData?.descricao ?? undefined)}
                onChange={isEdit ? (e) => setDescricao(e.target.value) : undefined}
                className={ui.input}
              />
            )}
          </div>
        </div>

        <PermissoesPanel
          grupos={grupos}
          selecionadas={selecionadas}
          onChange={setSelecionadas}
          disabled={isView}
          tituloSelecionadas="Do perfil"
        />
      </div>

      <div className={ui.rowActions}>
        {isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button label={isEdit ? "Salvar" : "Gravar"} variant="primary" type="submit" disabled={saving} />
          </>
        )}
      </div>
    </form>
  );
}
