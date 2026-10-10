"use client";

import { useState } from "react";
import { createFornecedor, updateFornecedor, buscarCep } from "../actions";
import type { FornecedorFormData } from "../actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import EnderecoFields from "@/components/EnderecoFields";
import { normalizaTelefones } from "@/lib/contatos";
import Button from "@/components/Button";
import { ui } from "@/lib/ui";
import { useAviso } from "@/components/AvisoProvider";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FornecedorFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FornecedorForm({
  mode = "create", initialData, tiposCodigo, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
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
      if (initialData) form.set("id_fornecedor", String(initialData.id_fornecedor));
      const result = initialData
        ? await updateFornecedor(form)
        : await createFornecedor(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  const textField = (label: string, name: string, value?: string | null) => (
    <div className={ui.field}>
      <label className={ui.label}>{label}</label>
      {isView ? (
        <p className={`${ui.input} leading-[2.5] m-0`}>{value ?? "—"}</p>
      ) : (
        <input name={name} defaultValue={value ?? undefined} readOnly={isView} className={ui.input} />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={ui.form}>
      <div className="grid grid-cols-[1fr_1fr] gap-6 items-stretch">
        {/* Coluna esquerda — dados, endereço e códigos */}
        <div className="flex flex-col gap-4">
          {isEdit && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink cursor-pointer">
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand" />
              Ativo
            </label>
          )}

          {textField("Razão Social", "razao_social", initialData?.razao_social)}
          {textField("CNPJ", "cnpj", initialData?.cnpj)}
          {textField("Contato", "contato", initialData?.contato)}

          <hr className="border-0 border-t border-[#e0e0e0] my-1" />
          <p className="font-sans text-sm text-[#616161] m-0">Endereço (opcional)</p>

          <EnderecoFields
            key={initialData?.id_fornecedor ?? "novo"}
            disabled={isView}
            showCoords
            onLookup={buscarCep}
            initial={initialData?.endereco ? {
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
