"use client";

import { useState } from "react";
import { createDestinatario, updateDestinatario, buscarCep } from "../actions";
import type { DestinatarioFormData } from "../actions";
import { consultarCnpj } from "@/app/consulta-cnpj/actions";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import EnderecoFields, { type EnderecoInitial } from "@/components/EnderecoFields";
import CnpjField from "@/components/CnpjField";
import { normalizaTelefones } from "@/lib/contatos";
import { formatarCnpj, validarCnpj } from "@/lib/cnpj";
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
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia ?? "");
  const [cnpj, setCnpj] = useState(formatarCnpj(initialData?.cnpj ?? ""));
  const [consultando, setConsultando] = useState(false);
  const [sugestaoEndereco, setSugestaoEndereco] = useState<EnderecoInitial | null>(null);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);
  const [emails, setEmails] = useState<EmailEntry[]>(initialData?.emails ?? []);
  const [telefones, setTelefones] = useState<TelefoneEntry[]>(normalizaTelefones(initialData?.telefones));

  async function consultarDadosCnpj() {
    const validacao = validarCnpj(cnpj);
    if (!validacao.ok) {
      mostrarAviso(validacao.erro, "erro");
      return;
    }
    setConsultando(true);
    try {
      const resultado = await consultarCnpj(validacao.cnpj);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        return;
      }
      const { empresa } = resultado;
      setCnpj(formatarCnpj(empresa.cnpj));
      setRazaoSocial(empresa.razao_social);
      setNomeFantasia(empresa.nome_fantasia ?? "");
      setSugestaoEndereco({
        cep: empresa.endereco.cep,
        logradouro: empresa.endereco.logradouro,
        numero: empresa.endereco.numero,
        complemento: empresa.endereco.complemento,
        bairro: empresa.endereco.bairro,
        cidade: empresa.endereco.cidade,
        uf: empresa.endereco.uf,
      });
      if (empresa.situacao && empresa.situacao.toUpperCase() !== "ATIVA") {
        mostrarAviso(`Dados preenchidos, mas a situação do CNPJ é ${empresa.situacao}.`, "cautela");
      } else {
        mostrarAviso("Dados do CNPJ preenchidos. Revise antes de salvar.", "sucesso");
      }
    } catch {
      mostrarAviso("Não foi possível consultar o CNPJ. Tente novamente.", "erro");
    } finally {
      setConsultando(false);
    }
  }

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
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              readOnly={isView}
              className={ui.input}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Nome fantasia</label>
            {isView ? (
              <p className={`${ui.input} leading-[2.5] m-0`}>{nomeFantasia || "—"}</p>
            ) : (
              <input
                name="nome_fantasia"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                className={ui.input}
              />
            )}
          </div>

          <CnpjField
            value={cnpj}
            onChange={setCnpj}
            readOnly={isView}
            onConsultar={consultarDadosCnpj}
            consultando={consultando}
          />

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
            sugestao={sugestaoEndereco}
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
