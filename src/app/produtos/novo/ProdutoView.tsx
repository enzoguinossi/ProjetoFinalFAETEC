"use client";

import { useState } from "react";
import { getProduto } from "../actions";
import type { ProdutoFormData } from "../actions";
import { formatarCodigo } from "@/lib/formatar";
import CodigosSection from "@/components/CodigosSection";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import FormShell from "@/components/form/FormShell";
import FormSection from "@/components/form/FormSection";
import { FormGrid } from "@/components/form/FormField";
import IdentityBand from "@/components/form/IdentityBand";
import SaldoReadout from "@/components/form/SaldoReadout";
import CompactList from "@/components/form/CompactList";
import DesmembrarProdutoModal from "./DesmembrarProdutoModal";

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

interface Props {
  conversoes: Conversao[];
  tiposCodigo: TipoCodigo[];
  data: ProdutoFormData;
  onClose?: () => void;
  /** `estoque.entrada` + `estoque.saida`: habilita o botão Desmembrar. */
  podeDesmembrar?: boolean;
  /** Avisa a lista de que saldo/insumos mudaram. */
  onChanged?: () => void;
}

type InsumoEntry = { id: number; descricao: string; qtd: string };

function ViewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-xs leading-4 text-[#697077]">{label}</span>
      <span className="font-sans text-sm leading-5 text-ink-strong">
        {value ?? ""}
      </span>
    </div>
  );
}

/** Data `YYYY-MM-DD` como `DD/MM/AAAA` (sem deslocamento de fuso). */
function formatarData(valor: string | null): string | null {
  if (!valor) return null;
  const [ano, mes, dia] = valor.split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

export default function ProdutoView({
  conversoes,
  tiposCodigo,
  data,
  onClose,
  podeDesmembrar = false,
  onChanged,
}: Props) {
  const [insumoViewData, setInsumoViewData] = useState<ProdutoFormData | null>(null);
  const [produtoAtual, setProdutoAtual] = useState<ProdutoFormData | null>(null);
  const [desmembrarAberto, setDesmembrarAberto] = useState(false);

  // O desmembramento altera saldos e insumos: a visualização recarrega o
  // produto sem fechar o modal.
  const produto = produtoAtual ?? data;

  const insumos: InsumoEntry[] = produto.insumos.map((i) => ({
    id: i.id,
    descricao: i.descricao,
    qtd: String(i.qtd),
  }));

  const unidadeEntrada =
    conversoes.find((c) => c.id_conversao === produto.id_conversao_padrao)?.nome ?? "";
  const unidadeSaida =
    conversoes.find((c) => c.id_conversao === produto.id_conversao_saida)?.nome ?? "";
  const foto = produto.fotos[0]?.url ?? produto.foto_url ?? null;

  async function visualizarInsumo(item: InsumoEntry) {
    const carregado = await getProduto(item.id);
    if (carregado) setInsumoViewData(carregado);
  }

  async function aoDesmembrar() {
    const atualizado = await getProduto(produto.id_produto);
    if (atualizado) setProdutoAtual(atualizado);
    onChanged?.();
  }

  return (
    <>
      <FormShell
        identity={
          <IdentityBand
            media={
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
                    alt="Foto do produto"
                    className="h-full w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-[#eef1f4] text-[#697077]"
                  aria-hidden="true"
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="m21 15-4.5-4.5L7 20" />
                  </svg>
                </div>
              )
            }
            title={produto.descricao}
            meta={`Código ${formatarCodigo(produto.id_produto)}`}
            chips={[
              ...(produto.perecivel
                ? [{ label: "Perecível", tone: "warning" as const }]
                : []),
              ...(produto.composto
                ? [{ label: "Composto", tone: "brand" as const }]
                : []),
            ]}
            aside={
              <div className="flex flex-row items-center gap-3">
                <SaldoReadout
                  saldo={produto.saldo}
                  reservado={produto.saldo_reservado}
                />
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4 ${
                    produto.ativo
                      ? "bg-[rgba(27,153,86,0.12)] text-[#15844a]"
                      : "bg-[#eef1f4] text-[#697077]"
                  }`}
                >
                  {produto.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            }
          />
        }
        actions={
          <>
            <Button label="Fechar" variant="cancel" onClick={onClose} />
            {produto.ativo && produto.composto && insumos.length > 0 && podeDesmembrar && (
              <Button
                label="Desmembrar"
                onClick={() => setDesmembrarAberto(true)}
              />
            )}
          </>
        }
      >
        <FormSection title="Dados do produto">
          <FormGrid columns={3}>
            <ViewField label="Conversão Padrão de Entrada" value={unidadeEntrada} />
            <ViewField label="Unidade Padrão de Saída" value={unidadeSaida} />
            <ViewField label="Perecível" value={produto.perecivel ? "Sim" : "Não"} />
            <ViewField label="Composto" value={produto.composto ? "Sim" : "Não"} />
            {produto.perecivel && (
              <ViewField label="Validade" value={formatarData(produto.data_validade)} />
            )}
          </FormGrid>
        </FormSection>

        <FormSection title="Códigos">
          <CodigosSection
            variant="compact"
            tiposCodigo={tiposCodigo}
            value={produto.codigos}
            onChange={() => {}}
            disabled
          />
        </FormSection>

        {produto.composto && (
          <FormSection title="Insumos">
            <CompactList
              items={insumos}
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
                  render: (insumo) => insumo.qtd,
                },
              ]}
              actions={[
                {
                  icon: "/icons/actions/Olho.svg",
                  label: "Visualizar",
                  onClick: visualizarInsumo,
                },
              ]}
              empty="Nenhum insumo cadastrado."
              search={(insumo) => insumo.descricao}
              searchPlaceholder="Buscar insumo..."
              noun={{ singular: "insumo", plural: "insumos" }}
            />
          </FormSection>
        )}
      </FormShell>

      <Modal
        open={insumoViewData !== null}
        onClose={() => setInsumoViewData(null)}
        width="860px"
      >
        {insumoViewData && (
          <ProdutoView
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            data={insumoViewData}
            onClose={() => setInsumoViewData(null)}
            podeDesmembrar={false}
          />
        )}
      </Modal>

      {desmembrarAberto && (
        <DesmembrarProdutoModal
          idProduto={produto.id_produto}
          onClose={() => setDesmembrarAberto(false)}
          onSuccess={() => void aoDesmembrar()}
        />
      )}
    </>
  );
}
