"use client";

import { useState } from "react";
import { createFornecedor, updateFornecedor, buscarCep } from "../actions";
import type { FornecedorFormData } from "../actions";
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
  initialData?: FornecedorFormData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  /** Recebe o id do fornecedor quando a criação termina com sucesso. */
  onSuccess?: (id_fornecedor?: number) => void;
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
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia ?? "");
  const [cnpj, setCnpj] = useState(formatarCnpj(initialData?.cnpj ?? ""));
  const [consultando, setConsultando] = useState(false);
  const [sugestaoEndereco, setSugestaoEndereco] = useState<EnderecoInitial | null>(null);
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
      if (initialData) form.set("id_fornecedor", String(initialData.id_fornecedor));
      form.set("codigos", JSON.stringify(codigos));
      form.set("contatos", JSON.stringify({ emails, telefones }));
      const result = initialData
        ? await updateFornecedor(form)
        : await createFornecedor(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.(
        !initialData &&
          "id_fornecedor" in result &&
          typeof result.id_fornecedor === "number"
          ? result.id_fornecedor
          : undefined,
      );
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  const textField = (
    label: string,
    name: string,
    value: string,
    onChange: (valor: string) => void,
  ) => (
    <div className={ui.field}>
      <label className={ui.label}>{label}</label>
      {isView ? (
        <p className={`${ui.input} leading-[2.5] m-0`}>{value || "—"}</p>
      ) : (
        <input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isView}
          className={ui.input}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={ui.form} data-figma="FormularioFornecedor" data-figma-hug="vertical">
      <div className="grid grid-cols-[1fr_1fr] gap-6 items-stretch">
        {/* Coluna esquerda — dados, endereço e códigos */}
        <div className="flex flex-col gap-4">
          {isEdit && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink cursor-pointer">
              <input type="checkbox" name="ativo" checked={ativo} disabled={!canDeactivate} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand" />
              Ativo
            </label>
          )}

          {textField("Razão Social", "razao_social", razaoSocial, setRazaoSocial)}
          {textField("Nome fantasia", "nome_fantasia", nomeFantasia, setNomeFantasia)}
          <CnpjField
            value={cnpj}
            onChange={setCnpj}
            readOnly={isView}
            onConsultar={consultarDadosCnpj}
            consultando={consultando}
          />

          <hr className="border-0 border-t border-[#e0e0e0] my-1" />
          <p className="font-sans text-sm text-[#616161] m-0">Endereço (opcional)</p>

          <EnderecoFields
            key={initialData?.id_fornecedor ?? "novo"}
            disabled={isView}
            showCoords
            onLookup={buscarCep}
            sugestao={sugestaoEndereco}
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
