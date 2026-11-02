"use client";

import { useState } from "react";
import { createProduto, updateProduto, getProduto, listarProdutos } from "../actions";
import type { ProdutoFormData } from "../actions";
import SearchEntityModal from "@/components/SearchEntityModal";
import { COLUNAS_PRODUTO, type ProdutoListRow } from "@/lib/produto-linha";
import { formatarCodigo } from "@/lib/formatar";
import CodigosSection, { type CodigoEntry } from "@/components/CodigosSection";
import UnidadesModal from "@/components/UnidadesModal";
import Modal from "@/components/Modal";
import ProdutoView from "./ProdutoView";
import FotosField from "@/components/FotosField";
import Button from "@/components/Button";
import { useAviso } from "@/components/AvisoProvider";
import FormShell from "@/components/form/FormShell";
import FormSection from "@/components/form/FormSection";
import FormField, { FormGrid } from "@/components/form/FormField";
import IdentityBand from "@/components/form/IdentityBand";
import SaldoReadout from "@/components/form/SaldoReadout";
import StatusSwitch from "@/components/form/StatusSwitch";
import CompactList from "@/components/form/CompactList";

interface Conversao {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
  padrao: boolean;
}

interface TipoCodigo {
  id_tipo_codigo: number;
  nome: string;
}

export interface ProdutoItem {
  id_produto: number;
  descricao: string;
}

interface Props {
  conversoes: Conversao[];
  tiposCodigo: TipoCodigo[];
  initialData?: ProdutoFormData;
  canDeactivate?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type InsumoEntry = { id: number; descricao: string; qtd: string };

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none transition-[border-color] duration-[120ms] w-full box-border bg-white focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";
const CHECKBOX_LABEL_CLASS =
  "flex items-center gap-2 font-sans text-sm font-normal text-ink-strong leading-[1.4] cursor-pointer [&_input[type=checkbox]]:size-[1.125rem] [&_input[type=checkbox]]:accent-brand [&_input[type=checkbox]]:cursor-pointer";

export default function ProdutoForm({
  conversoes, tiposCodigo, initialData, canDeactivate = true,
  onSuccess, onCancel,
}: Props) {
  const isEdit = initialData !== undefined;

  const [saving, setSaving] = useState(false);
  const mostrarAviso = useAviso();
  const [perecivel, setPerecivel] = useState(initialData?.perecivel ?? false);
  const [composto, setComposto] = useState(initialData?.composto ?? false);
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [idConversao, setIdConversao] = useState<number | null>(
    initialData?.id_conversao_padrao ??
      conversoes.find((c) => c.padrao)?.id_conversao ??
      null,
  );
  const [idConversaoSaida, setIdConversaoSaida] = useState<number | null>(
    initialData?.id_conversao_saida ??
      conversoes.find((c) => c.padrao)?.id_conversao ??
      null,
  );
  const [conversoesAtuais, setConversoesAtuais] = useState<Conversao[]>(conversoes);
  const [unidadesModalOpen, setUnidadesModalOpen] = useState(false);

  const [codigos, setCodigos] = useState<CodigoEntry[]>(initialData?.codigos ?? []);

  const [insumos, setInsumos] = useState<InsumoEntry[]>(
    initialData?.insumos.map((i) => ({ id: i.id, descricao: i.descricao, qtd: String(i.qtd) })) ?? [],
  );
  const [insumosExpandidos, setInsumosExpandidos] = useState(false);
  const [buscandoInsumo, setBuscandoInsumo] = useState(false);
  const [insumoViewData, setInsumoViewData] = useState<ProdutoFormData | null>(null);

  const codigo = isEdit ? formatarCodigo(initialData.id_produto) : null;

  // ── Insumos ──

  function adicionarInsumo(prod: ProdutoItem) {
    setInsumos((atuais) => {
      if (atuais.some((insumo) => insumo.id === prod.id_produto)) return atuais;
      return [{ id: prod.id_produto, descricao: prod.descricao, qtd: "1" }, ...atuais];
    });
    setInsumosExpandidos(true);
    setBuscandoInsumo(false);
  }

  function removerInsumo(id: number) {
    setInsumos((atuais) => atuais.filter((insumo) => insumo.id !== id));
  }

  function alterarQuantidade(id: number, qtd: string) {
    setInsumos((atuais) =>
      atuais.map((insumo) => (insumo.id === id ? { ...insumo, qtd } : insumo)),
    );
  }

  async function visualizarInsumo(item: InsumoEntry) {
    const produto = await getProduto(item.id);
    if (produto) setInsumoViewData(produto);
  }

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      if (initialData) form.set("id_produto", String(initialData.id_produto));
      form.set("codigos", JSON.stringify(codigos));
      form.set("insumos", JSON.stringify(insumos.map((i) => ({ id: i.id, qtd: i.qtd }))));
      const result = initialData
        ? await updateProduto(form)
        : await createProduto(form);
      if (result.error) { mostrarAviso(result.error, "erro"); return; }
      mostrarAviso(initialData ? "Alterações salvas com sucesso." : "Cadastro concluído com sucesso.", "sucesso");
      onSuccess?.();
    } catch {
      mostrarAviso("Erro ao salvar. Tente novamente.", "erro");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  return (
    <>
      <FormShell
        data-figma="FormularioProduto"
        onSubmit={handleSubmit}
        identity={
          <IdentityBand
            media={
              <FotosField
                key={initialData?.fotos.map((foto) => foto.id_anexo).join(",") ?? "novo"}
                variant="identity"
                initial={initialData?.fotos ?? []}
                max={1}
                allowUrl
                label="Foto"
              />
            }
            title={isEdit ? "Editar produto" : "Novo produto"}
            meta={
              codigo ? `Código ${codigo}` : "Código gerado ao salvar"
            }
            chips={[
              ...(perecivel ? [{ label: "Perecível", tone: "warning" as const }] : []),
              ...(composto ? [{ label: "Composto", tone: "brand" as const }] : []),
            ]}
            aside={
              <div className="flex flex-row items-center gap-4">
                <SaldoReadout
                  saldo={initialData?.saldo ?? 0}
                  reservado={initialData?.saldo_reservado ?? 0}
                />
                {isEdit ? (
                  <StatusSwitch
                    checked={ativo}
                    onChange={setAtivo}
                    disabled={!canDeactivate}
                    hint={canDeactivate ? undefined : "Sem permissão para desativar."}
                  />
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[rgba(27,153,86,0.12)] px-2 py-0.5 font-sans text-xs leading-4 text-[#15844a]">
                    Ativo
                  </span>
                )}
              </div>
            }
          />
        }
        actions={
          <>
            <Button label="Cancelar" variant="cancel" onClick={onCancel} />
            <Button
              label={isEdit ? "Salvar produto" : "Criar produto"}
              variant="primary"
              type="submit"
              disabled={saving}
            />
          </>
        }
      >
        <FormSection
          title="Dados do produto"
          action={
            <Button
              label="Gerenciar unidades"
              variant="ghost"
              onClick={() => setUnidadesModalOpen(true)}
            />
          }
        >
          <FormField
            label="Descrição do produto"
            htmlFor="produto-descricao"
            required
          >
            <input
              id="produto-descricao"
              className={INPUT_CLASS}
              name="descricao"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </FormField>

          <FormGrid>
            <FormField
              label="Conversão Padrão de Entrada"
              htmlFor="produto-conversao"
              hint="Fator aplicado na entrada do estoque; o saldo fica sempre em base (UNIDADE)."
            >
              <select
                id="produto-conversao"
                className={INPUT_CLASS}
                name="id_conversao"
                required
                value={idConversao ?? ""}
                onChange={(e) => setIdConversao(e.target.value ? Number(e.target.value) : null)}
              >
                {conversoesAtuais.map((c) => (
                  <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Unidade Padrão de Saída"
              htmlFor="produto-conversao-saida"
              hint="Usada somente em notas de saída do tipo Remessa."
            >
              <select
                id="produto-conversao-saida"
                className={INPUT_CLASS}
                name="id_conversao_saida"
                required
                value={idConversaoSaida ?? ""}
                onChange={(e) => setIdConversaoSaida(e.target.value ? Number(e.target.value) : null)}
              >
                {conversoesAtuais.map((c) => (
                  <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
                ))}
              </select>
            </FormField>
          </FormGrid>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="flex flex-col gap-2">
              <label className={CHECKBOX_LABEL_CLASS}>
                <input type="checkbox" name="perecivel" checked={perecivel} onChange={(e) => setPerecivel(e.target.checked)} />
                Perecível
              </label>
              <label className={CHECKBOX_LABEL_CLASS}>
                <input type="checkbox" name="composto" checked={composto} onChange={(e) => setComposto(e.target.checked)} />
                Composto
              </label>
            </div>
            {perecivel && (
              <FormField label="Validade" htmlFor="produto-validade" className="w-52">
                <input
                  id="produto-validade"
                  className={INPUT_CLASS}
                  type="date"
                  name="data_validade"
                  defaultValue={initialData?.data_validade ?? undefined}
                />
              </FormField>
            )}
          </div>
        </FormSection>

        <FormSection title="Códigos">
          <CodigosSection
            variant="compact"
            tiposCodigo={tiposCodigo}
            value={codigos}
            onChange={setCodigos}
          />
        </FormSection>

        {composto && (
          <FormSection title="Insumos">
            <CompactList
              items={insumos}
              expanded={insumosExpandidos}
              onExpandedChange={setInsumosExpandidos}
              rowKey={(insumo) => String(insumo.id)}
              columns={[
                {
                  key: "descricao",
                  label: "Produto",
                  width: "3fr",
                  render: (insumo) => insumo.descricao,
                },
                {
                  key: "qtd",
                  label: "Quantidade",
                  width: "1.2fr",
                  align: "right",
                  render: (insumo) => (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={insumo.qtd}
                      aria-label={`Quantidade de ${insumo.descricao}`}
                      onChange={(e) => alterarQuantidade(insumo.id, e.target.value)}
                      className="h-7 w-24 rounded-md border border-border-input bg-white px-2 text-right font-sans text-[0.8125rem] outline-none focus:border-brand"
                    />
                  ),
                },
              ]}
              actions={[
                {
                  icon: "/icons/actions/Olho.svg",
                  label: "Visualizar",
                  onClick: visualizarInsumo,
                },
                {
                  icon: "/icons/actions/Lixeira.svg",
                  label: "Remover",
                  onClick: (insumo) => removerInsumo(insumo.id),
                },
              ]}
              onAdd={{ label: "Adicionar insumo", onClick: () => setBuscandoInsumo(true) }}
              empty="Nenhum insumo adicionado ainda."
              search={(insumo) => insumo.descricao}
              searchPlaceholder="Buscar insumo..."
              noun={{ singular: "insumo", plural: "insumos" }}
            />
          </FormSection>
        )}
      </FormShell>

      <SearchEntityModal<ProdutoListRow>
        open={buscandoInsumo}
        onClose={() => setBuscandoInsumo(false)}
        onSelect={adicionarInsumo}
        title="Selecionar Produto"
        columns={COLUNAS_PRODUTO}
        loadPage={listarProdutos}
        getItemId={(item) => item.id_produto}
        excludeIds={insumos.map((i) => i.id).filter((id) => id > 0)}
        placeholder="Filtrar produto por código ou descrição..."
      />

      <UnidadesModal
        open={unidadesModalOpen}
        onClose={() => setUnidadesModalOpen(false)}
        initial={conversoesAtuais}
        onChanged={(lista) => {
          const mapeadas = lista.map((u) => ({
            id_conversao: u.id_conversao,
            nome: u.nome,
            fator: u.fator,
            descricao: u.descricao,
            padrao: u.padrao,
          }));
          setConversoesAtuais(mapeadas);
          if (idConversao === null) {
            setIdConversao(mapeadas.find((c) => c.padrao)?.id_conversao ?? null);
          }
          if (idConversaoSaida === null) {
            setIdConversaoSaida(mapeadas.find((c) => c.padrao)?.id_conversao ?? null);
          }
        }}
      />

      <Modal
        open={insumoViewData !== null}
        onClose={() => setInsumoViewData(null)}
        width="860px"
      >
        {insumoViewData && (
          <ProdutoView
            conversoes={conversoesAtuais}
            tiposCodigo={tiposCodigo}
            data={insumoViewData}
            onClose={() => setInsumoViewData(null)}
          />
        )}
      </Modal>
    </>
  );
}
