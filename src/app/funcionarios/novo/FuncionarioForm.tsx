"use client";

import { useState } from "react";
import { createFuncionario, updateFuncionario } from "../actions";
import type { FuncionarioFormData } from "../actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import { normalizaTelefones } from "@/lib/contatos";
import { CPF_MAX_CARACTERES, formatarCpf } from "@/lib/cpf";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FuncionarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FuncionarioForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [cpf, setCpf] = useState(formatarCpf(initialData?.cpf ?? ""));
  const [cargo, setCargo] = useState(initialData?.cargo ?? "");
  const [condutor, setCondutor] = useState(initialData?.condutor ?? false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);
  const [emails, setEmails] = useState<EmailEntry[]>(initialData?.emails ?? []);
  const [telefones, setTelefones] = useState<TelefoneEntry[]>(normalizaTelefones(initialData?.telefones));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isView) return;
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_funcionario", String(initialData.id_funcionario));
      form.set("codigos", JSON.stringify(codigos));
      form.set("contatos", JSON.stringify({ emails, telefones }));
      const result = initialData
        ? await updateFuncionario(form)
        : await createFuncionario(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  const textField = (label: string, name: string, value?: string | null, stateValue?: string, setState?: (v: string) => void, required = false) => (
    <div className={ui.field}>
      <label className={ui.label}>{label}</label>
      {isView ? (
        <p className={`${ui.input} leading-[2.5] m-0`}>{value ?? "—"}</p>
      ) : (
        <input
          name={name}
          required={required}
          value={isEdit ? stateValue : undefined}
          onChange={isEdit && setState ? (e) => setState(e.target.value) : undefined}
          readOnly={isView}
          className={ui.input}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={ui.form} data-figma="FormularioFuncionario" data-figma-hug="vertical">
      <div className="grid grid-cols-[1fr_1fr] gap-6 items-stretch">
        {/* Coluna esquerda — dados */}
        <div className="flex flex-col gap-4">
          {isEdit && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink cursor-pointer">
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand" />
              Ativo
            </label>
          )}

          {textField("Nome", "nome", initialData?.nome, nome, setNome, true)}
          <div className={ui.field}>
            <label className={ui.label}>CPF</label>
            {isView ? (
              <p className={`${ui.input} leading-[2.5] m-0`}>{cpf || "—"}</p>
            ) : (
              <input
                name="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                maxLength={CPF_MAX_CARACTERES}
                placeholder="000.000.000-00"
                className={ui.input}
              />
            )}
          </div>
          {textField("Cargo", "cargo", initialData?.cargo, cargo, setCargo)}

          {!isView ? (
            <label className="flex items-center gap-2 font-sans text-base text-ink-strong cursor-pointer">
              <input type="checkbox" name="condutor" checked={condutor} onChange={(e) => setCondutor(e.target.checked)} className="accent-brand w-[1.125rem] h-[1.125rem]" />
              É condutor
            </label>
          ) : (
            <div className={ui.field}>
              <label className={ui.label}>Condutor</label>
              <p className={`${ui.input} leading-[2.5] m-0`}>{initialData?.condutor ? "Sim" : "Não"}</p>
            </div>
          )}

          <CodigosSection
            tiposCodigo={tiposCodigo}
            value={codigos}
            onChange={setCodigos}
            disabled={isView}
          />
        </div>

        {/* Coluna direita — contatos */}
        <ContatosSection
          emails={emails}
          telefones={telefones}
          onEmailsChange={setEmails}
          onTelefonesChange={setTelefones}
          disabled={isView}
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
