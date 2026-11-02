"use client";

import { useState } from "react";
import { consultarCnpj } from "@/app/consulta-cnpj/actions";
import type { ResultadoCep } from "@/services/cep";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import ContatosSection, { type EmailEntry, type TelefoneEntry } from "@/components/ContatosSection";
import CnpjField from "@/components/CnpjField";
import EnderecoFields, { type EnderecoInitial } from "@/components/EnderecoFields";
import { normalizaTelefones } from "@/lib/contatos";
import { formatarCnpj, validarCnpj } from "@/lib/cnpj";
import { formatarCodigo } from "@/lib/formatar";
import {
  ROTULOS_TIPO_DESTINATARIO,
  TIPO_DESTINATARIO,
  type TipoDestinatario,
} from "@/types";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import FormShell from "@/components/form/FormShell";
import FormSection from "@/components/form/FormSection";
import FormField, { FormGrid } from "@/components/form/FormField";
import IdentityBand from "@/components/form/IdentityBand";
import StatusSwitch from "@/components/form/StatusSwitch";

export type EmpresaFichaData = {
  id: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  ativo: boolean;
  tipo_destinatario?: TipoDestinatario;
  endereco: {
    logradouro: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string;
    uf: string | null;
    cep: string | null;
  } | null;
  codigos: { tipo: string; valor: string }[];
  emails: { endereco: string; principal: boolean }[];
  telefones: { numero: string; tipo: "CELULAR" | "FIXO" | "COMERCIAL"; principal: boolean }[];
};

type ResultadoSalvar = { error?: string; success?: boolean; id_fornecedor?: number };

interface Props {
  mode: "create" | "edit" | "view";
  tipo: "destinatario" | "fornecedor";
  initialData?: EmpresaFichaData;
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
  canDeactivate?: boolean;
  criar: (formData: FormData) => Promise<ResultadoSalvar>;
  atualizar: (formData: FormData) => Promise<ResultadoSalvar>;
  buscarCep: (cep: string) => Promise<ResultadoCep>;
  onSuccess?: (id_fornecedor?: number) => void;
  onCancel?: () => void;
  "data-figma"?: string;
}

const INPUT_CLASS =
  "h-10 w-full box-border rounded-lg border border-border-input bg-white px-4 font-sans text-base outline-none transition-[border-color] duration-[120ms] focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";

const CHIP_ATIVO =
  "inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4";
const CHIP_ATIVO_ON = "bg-[rgba(27,153,86,0.12)] text-[#15844a]";
const CHIP_ATIVO_OFF = "bg-[#eef1f4] text-[#697077]";

const SUFIXOS_SOCIETARIOS = new Set(["me", "mei", "ltda", "eireli", "epp", "sa"]);
const CONECTORES = new Set(["e", "da", "de", "do", "das", "dos"]);

function iniciaisDaRazao(razao: string): string {
  const significativas = razao
    .trim()
    .split(/\s+/)
    .filter((parte) => {
      const normalizada = parte.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
      if (!normalizada) return false;
      return (
        !SUFIXOS_SOCIETARIOS.has(normalizada) && !CONECTORES.has(normalizada)
      );
    });
  if (significativas.length === 0) return "—";
  if (significativas.length === 1) return significativas[0]!.slice(0, 2).toUpperCase();
  return (
    significativas[0]![0]! + significativas[significativas.length - 1]![0]!
  ).toUpperCase();
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

/**
 * Ficha compartilhada de destinatário e fornecedor: banda de identidade,
 * seções Identificação/Endereço/Contato/Códigos e rodapé fixo.
 *
 * A consulta de CNPJ preenche a Receita (a situação é só aviso) e a busca de
 * CEP preserva número e complemento digitados.
 */
export default function EmpresaFicha({
  mode,
  tipo,
  initialData,
  tiposCodigo,
  canDeactivate = true,
  criar,
  atualizar,
  buscarCep,
  onSuccess,
  onCancel,
  ...marcas
}: Props) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia ?? "");
  const [cnpj, setCnpj] = useState(formatarCnpj(initialData?.cnpj ?? ""));
  const [tipoDestinatario, setTipoDestinatario] = useState<TipoDestinatario>(
    initialData?.tipo_destinatario ?? "ESCOLA",
  );
  const [consultando, setConsultando] = useState(false);
  const [preenchidoPelaReceita, setPreenchidoPelaReceita] = useState(false);
  const [sugestaoEndereco, setSugestaoEndereco] = useState<EnderecoInitial | null>(null);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);
  const [emails, setEmails] = useState<EmailEntry[]>(initialData?.emails ?? []);
  const [telefones, setTelefones] = useState<TelefoneEntry[]>(
    normalizaTelefones(initialData?.telefones),
  );
  const mostrarAviso = useAviso();

  const tituloCriacao = tipo === "destinatario" ? "Novo destinatário" : "Novo fornecedor";
  const tituloEdicao = tipo === "destinatario" ? "Editar destinatário" : "Editar fornecedor";
  const titulo = isView ? razaoSocial || "—" : isEdit ? tituloEdicao : tituloCriacao;
  const meta = isView
    ? cnpj
      ? `CNPJ ${formatarCnpj(cnpj)}`
      : "Sem CNPJ"
    : initialData
      ? `Código ${formatarCodigo(initialData.id)}`
      : "Código gerado ao salvar";
  const chipTipo =
    tipo === "fornecedor"
      ? "Fornecedor"
      : ROTULOS_TIPO_DESTINATARIO[tipoDestinatario];

  async function consultarDadosCnpj() {
    const validacao = validarCnpj(cnpj);
    if (!validacao.ok) {
      mostrarAviso(validacao.erro, "erro");
      setPreenchidoPelaReceita(false);
      return;
    }
    setConsultando(true);
    try {
      const resultado = await consultarCnpj(validacao.cnpj);
      if ("error" in resultado) {
        mostrarAviso(resultado.error, "erro");
        setPreenchidoPelaReceita(false);
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
      setPreenchidoPelaReceita(true);
      if (empresa.situacao && empresa.situacao.toUpperCase() !== "ATIVA") {
        mostrarAviso(`Dados preenchidos, mas a situação do CNPJ é ${empresa.situacao}.`, "cautela");
      } else {
        mostrarAviso("Dados do CNPJ preenchidos. Revise antes de salvar.", "sucesso");
      }
    } catch {
      mostrarAviso("Não foi possível consultar o CNPJ. Tente novamente.", "erro");
      setPreenchidoPelaReceita(false);
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
      if (initialData) {
        form.set(
          tipo === "destinatario" ? "id_destinatario" : "id_fornecedor",
          String(initialData.id),
        );
      }
      form.set("codigos", JSON.stringify(codigos));
      form.set("contatos", JSON.stringify({ emails, telefones }));
      if (tipo === "destinatario") {
        form.set("tipo_destinatario", tipoDestinatario);
      }
      const result = initialData ? await atualizar(form) : await criar(form);
      if (result.error) {
        mostrarAviso(result.error, "erro");
        return;
      }
      mostrarAviso(
        initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.",
        "sucesso",
      );
      onSuccess?.(result.id_fornecedor);
    } catch {
      mostrarAviso("Erro ao salvar.", "erro");
    } finally {
      setSaving(false);
    }
  }

  const enderecoInicial: EnderecoInitial | null = initialData?.endereco
    ? {
        logradouro: initialData.endereco.logradouro,
        numero: initialData.endereco.numero,
        complemento: initialData.endereco.complemento,
        bairro: initialData.endereco.bairro,
        cidade: initialData.endereco.cidade,
        uf: initialData.endereco.uf,
        cep: initialData.endereco.cep,
      }
    : null;

  return (
    <FormShell
      {...marcas}
      onSubmit={isView ? undefined : handleSubmit}
      identity={
        <IdentityBand
          media={
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-[#eef1f4] font-display text-2xl font-[590] text-[#697077]"
              aria-hidden="true"
            >
              {iniciaisDaRazao(razaoSocial)}
            </div>
          }
          title={titulo}
          meta={meta}
          chips={[{ label: chipTipo, tone: "brand" }]}
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
              label={
                isEdit
                  ? tipo === "destinatario"
                    ? "Salvar destinatário"
                    : "Salvar fornecedor"
                  : tipo === "destinatario"
                    ? "Criar destinatário"
                    : "Criar fornecedor"
              }
              variant="primary"
              type="submit"
              disabled={saving}
            />
          </>
        )
      }
    >
      <FormSection title="Identificação">
        {isView ? (
          <FormGrid columns={tipo === "destinatario" ? 2 : 1}>
            <ValorLeitura label="Nome fantasia" value={nomeFantasia || "—"} />
            {tipo === "destinatario" && (
              <ValorLeitura
                label="Tipo"
                value={ROTULOS_TIPO_DESTINATARIO[tipoDestinatario]}
              />
            )}
          </FormGrid>
        ) : (
          <>
            <FormGrid columns={2}>
              <FormField label="Razão social" htmlFor="empresa-razao-social" required>
                <input
                  id="empresa-razao-social"
                  name="razao_social"
                  required
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className={INPUT_CLASS}
                />
              </FormField>
              <FormField label="Nome fantasia" htmlFor="empresa-nome-fantasia">
                <input
                  id="empresa-nome-fantasia"
                  name="nome_fantasia"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  className={INPUT_CLASS}
                />
              </FormField>
            </FormGrid>

            <FormGrid columns={tipo === "destinatario" ? 2 : 1}>
              <CnpjField
                value={cnpj}
                onChange={(valor) => {
                  setCnpj(valor);
                  setPreenchidoPelaReceita(false);
                }}
                onConsultar={consultarDadosCnpj}
                consultando={consultando}
                hint={preenchidoPelaReceita ? "Preenchido pela Receita" : undefined}
              />
              {tipo === "destinatario" && (
                <FormField label="Tipo" htmlFor="empresa-tipo">
                  <select
                    id="empresa-tipo"
                    name="tipo_destinatario"
                    value={tipoDestinatario}
                    onChange={(e) =>
                      setTipoDestinatario(e.target.value as TipoDestinatario)
                    }
                    className={`${INPUT_CLASS} cursor-pointer`}
                  >
                    {TIPO_DESTINATARIO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_TIPO_DESTINATARIO[valor]}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
            </FormGrid>
          </>
        )}
      </FormSection>

      <FormSection
        title="Endereço"
        note={tipo === "fornecedor" ? "Opcional" : undefined}
      >
        <EnderecoFields
          key={initialData?.id ?? "novo"}
          disabled={isView}
          required={tipo === "destinatario"}
          onLookup={buscarCep}
          sugestao={sugestaoEndereco}
          initial={enderecoInicial}
        />
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
