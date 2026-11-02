"use client";

import { useState } from "react";
import { createFuncionario, updateFuncionario } from "../actions";
import type { FuncionarioFormData } from "../actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import FotosField from "@/components/FotosField";
import { normalizaTelefones } from "@/lib/contatos";
import { CPF_MAX_CARACTERES, formatarCpf } from "@/lib/cpf";
import { formatarCodigo } from "@/lib/formatar";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import FormShell from "@/components/form/FormShell";
import FormSection from "@/components/form/FormSection";
import FormField, { FormGrid } from "@/components/form/FormField";
import IdentityBand from "@/components/form/IdentityBand";
import StatusSwitch from "@/components/form/StatusSwitch";

interface Props {
  mode?: "create" | "edit" | "view";
  initialData?: FuncionarioFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none transition-[border-color] duration-[120ms] w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";
const CHECKBOX_LABEL_CLASS =
  "flex h-10 items-center gap-2 font-sans text-sm font-normal text-ink-strong leading-[1.4] cursor-pointer [&_input[type=checkbox]]:size-[1.125rem] [&_input[type=checkbox]]:accent-brand [&_input[type=checkbox]]:cursor-pointer";

const CHIP_ATIVO =
  "inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4";
const CHIP_ATIVO_ON = "bg-[rgba(27,153,86,0.12)] text-[#15844a]";
const CHIP_ATIVO_OFF = "bg-[#eef1f4] text-[#697077]";

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

function ValorLeitura({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-xs leading-4 text-[#697077]">{label}</span>
      <span className="font-sans text-sm leading-5 text-ink-strong">
        {value ?? "—"}
      </span>
    </div>
  );
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

  const foto = initialData?.fotos[0]?.url ?? initialData?.foto_url ?? null;
  const codigo = initialData ? formatarCodigo(initialData.id_funcionario) : null;

  // A marca vai para o Figma somente no formulário (criação/edição); a
  // visualização é um contêiner de leitura.
  const marcasFigma = isView ? {} : { "data-figma": "FormularioFuncionario" };

  return (
    <FormShell
      {...marcasFigma}
      onSubmit={isView ? undefined : handleSubmit}
      identity={
        <IdentityBand
          media={
            isView ? (
              foto ? (
                <a
                  href={foto}
                  target="_blank"
                  rel="noreferrer"
                  title="Ver foto"
                  className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white"
                >
                  <img
                    src={foto}
                    alt="Foto do funcionário"
                    className="h-full w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-[#eef1f4] font-display text-2xl font-[590] text-[#697077]"
                  aria-label="Sem foto"
                >
                  {iniciaisDoNome(nome)}
                </div>
              )
            ) : (
              <FotosField
                key={initialData?.fotos.map((foto) => foto.id_anexo).join(",") ?? "novo"}
                variant="identity"
                initial={initialData?.fotos ?? []}
                max={1}
                allowUrl
                label="Foto"
              />
            )
          }
          title={
            isView
              ? nome || "Funcionário"
              : isEdit
                ? "Editar funcionário"
                : "Novo funcionário"
          }
          meta={codigo ? `Código ${codigo}` : "Código gerado ao salvar"}
          chips={condutor ? [{ label: "Condutor", tone: "brand" }] : []}
          aside={
            isEdit ? (
              <StatusSwitch
                checked={ativo}
                onChange={setAtivo}
                disabled={!canDeactivate}
                hint={canDeactivate ? undefined : "Sem permissão para desativar."}
              />
            ) : (
              <span className={`${CHIP_ATIVO} ${ativo ? CHIP_ATIVO_ON : CHIP_ATIVO_OFF}`}>
                {ativo ? "Ativo" : "Inativo"}
              </span>
            )
          }
        />
      }
      actions={
        isView ? (
          <Button label="Fechar" variant="cancel" onClick={onCancel} />
        ) : (
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button
              label={isEdit ? "Salvar funcionário" : "Criar funcionário"}
              variant="primary"
              type="submit"
              disabled={saving}
            />
          </>
        )
      }
    >
      <FormSection title="Identificação">
        {!isView && (
          <FormField label="Nome" htmlFor="funcionario-nome" required>
            <input
              id="funcionario-nome"
              className={INPUT_CLASS}
              name="nome"
              required
              value={isEdit ? nome : undefined}
              onChange={isEdit ? (e) => setNome(e.target.value) : undefined}
            />
          </FormField>
        )}

        <FormGrid columns={3}>
          {isView ? (
            <ValorLeitura label="CPF" value={cpf || "—"} />
          ) : (
            <FormField label="CPF" htmlFor="funcionario-cpf">
              <input
                id="funcionario-cpf"
                name="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                maxLength={CPF_MAX_CARACTERES}
                placeholder="000.000.000-00"
                className={INPUT_CLASS}
              />
            </FormField>
          )}

          {isView ? (
            <ValorLeitura label="Cargo" value={cargo || "—"} />
          ) : (
            <FormField label="Cargo" htmlFor="funcionario-cargo">
              <input
                id="funcionario-cargo"
                name="cargo"
                className={INPUT_CLASS}
                value={isEdit ? cargo : undefined}
                onChange={isEdit ? (e) => setCargo(e.target.value) : undefined}
              />
            </FormField>
          )}

          {isView ? (
            <ValorLeitura label="Condutor" value={condutor ? "Sim" : "Não"} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-sm font-medium leading-5 text-ink-strong">
                Condutor
              </span>
              <label className={CHECKBOX_LABEL_CLASS}>
                <input
                  type="checkbox"
                  name="condutor"
                  checked={condutor}
                  onChange={(e) => setCondutor(e.target.checked)}
                />
                É condutor
              </label>
            </div>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Contato">
        <ContatosSection
          variant="compact"
          emails={emails}
          telefones={telefones}
          onEmailsChange={setEmails}
          onTelefonesChange={setTelefones}
          disabled={isView}
        />
      </FormSection>

      <FormSection title="Códigos">
        <CodigosSection
          variant="compact"
          tiposCodigo={tiposCodigo}
          value={codigos}
          onChange={setCodigos}
          disabled={isView}
        />
      </FormSection>
    </FormShell>
  );
}
