"use client";

import { useState } from "react";
import { createDestinatario, updateDestinatario, buscarCep } from "../actions";
import type { DestinatarioFormData } from "../actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import EnderecoFields from "@/components/EnderecoFields";
import { normalizaTelefones } from "@/lib/contatos";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: DestinatarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function DestinatarioForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social ?? "");
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
      if (initialData) form.set("id_destinatario", String(initialData.id_destinatario));
      form.set("codigos", JSON.stringify(codigos));
      form.set("contatos", JSON.stringify({ emails, telefones }));
      const result = initialData
        ? await updateDestinatario(form)
        : await createDestinatario(form);
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
    <form onSubmit={handleSubmit} className={ui.form} data-figma="FormularioDestinatario" data-figma-hug="vertical">
      <div className="grid grid-cols-[1fr_1fr] gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          {isEdit && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink cursor-pointer">
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand" />
              Ativo
            </label>
          )}

          <div className={ui.field}>
            <label className={ui.label}>Razão Social</label>
            <input
              name="razao_social"
              required={!isView}
              value={isView || isEdit ? razaoSocial : undefined}
              onChange={isEdit ? (e) => setRazaoSocial(e.target.value) : undefined}
              readOnly={isView}
              className={ui.input}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>CNPJ</label>
            {isView ? (
              <p className={`${ui.input} leading-[2.5] m-0`}>{initialData?.cnpj ?? "—"}</p>
            ) : (
              <input name="cnpj" defaultValue={initialData?.cnpj ?? undefined} className={ui.input} />
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Tipo</label>
            <select name="tipo_destinatario" defaultValue={initialData?.tipo_destinatario ?? "ESCOLA"} disabled={isView} className={ui.select}>
              <option value="ESCOLA">Escola</option>
              <option value="CRECHE">Creche</option>
            </select>
          </div>

          <EnderecoFields
            key={initialData?.id_destinatario ?? "novo"}
            disabled={isView}
            required
            showCoords
            onLookup={buscarCep}
            initial={initialData ? {
              logradouro: initialData.endereco.logradouro,
              numero: initialData.endereco.numero,
              complemento: initialData.endereco.complemento,
              bairro: initialData.endereco.bairro,
              cidade: initialData.endereco.cidade,
              uf: initialData.endereco.uf,
              cep: initialData.endereco.cep,
              latitude: initialData.endereco.latitude != null ? String(initialData.endereco.latitude) : "",
              longitude: initialData.endereco.longitude != null ? String(initialData.endereco.longitude) : "",
            } : null}
          />

          <CodigosSection
            tiposCodigo={tiposCodigo}
            value={codigos}
            onChange={setCodigos}
            disabled={isView}
          />
        </div>

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
