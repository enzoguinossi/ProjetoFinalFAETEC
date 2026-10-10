"use client";

import { useState } from "react";
import { getProduto } from "../actions";
import type { ProdutoFormData } from "../actions";
import DataTable from "@/components/DataTable";
import type { Column, Action } from "@/components/DataTable";
import CodigosSection from "@/components/CodigosSection";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface Conversao {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
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
}

type InsumoEntry = { id: number; descricao: string; qtd: string };

const INPUT_CLASS =
  "h-10 px-4 border border-border-input rounded-lg font-sans text-base outline-none w-full box-border bg-white";
const CHECKBOX_LABEL_CLASS =
  "flex items-center gap-2 font-sans text-base font-normal text-ink-strong leading-[1.4] [&_input[type=checkbox]]:size-[1.125rem] [&_input[type=checkbox]]:accent-brand";

export default function ProdutoView({ conversoes, tiposCodigo, data, onClose }: Props) {
  const [insumoViewData, setInsumoViewData] = useState<ProdutoFormData | null>(null);

  const insumos: InsumoEntry[] = data.insumos.map((i) => ({
    id: i.id,
    descricao: i.descricao,
    qtd: String(i.qtd),
  }));

  const insumoColumns: Column<InsumoEntry>[] = [
    { key: "descricao", label: "Produto", width: "3fr" },
    { key: "qtd", label: "Quantidade", width: "1fr" },
  ];

  const insumoActions: Action<InsumoEntry>[] = [
    {
      icon: "/icons/actions/Olho.svg",
      label: "Visualizar",
      onClick: async (row) => {
        const produto = await getProduto(row.id);
        if (produto) setInsumoViewData(produto);
      },
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-[11px] p-0 w-full box-border">
        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Descrição do produto</label>
          <input className={INPUT_CLASS} value={data.descricao} readOnly tabIndex={-1} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Unidade Padrão de Entrada</label>
          <select className={`${INPUT_CLASS} flex-1`} value={data.id_conversao_padrao ?? ""} disabled>
            <option value="">Selecione...</option>
            {conversoes.map((c) => (
              <option key={c.id_conversao} value={c.id_conversao}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-[5px]">
            <label className={CHECKBOX_LABEL_CLASS}>
              <input type="checkbox" checked={data.perecivel} readOnly disabled />
              Perecível
            </label>
            <label className={CHECKBOX_LABEL_CLASS}>
              <input type="checkbox" checked={data.composto} readOnly disabled />
              Composto
            </label>
          </div>
          {data.perecivel && (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Validade</label>
              <input
                className={INPUT_CLASS}
                type="date"
                value={data.data_validade ?? ""}
                readOnly
                tabIndex={-1}
              />
            </div>
          )}
        </div>

        <CodigosSection
          tiposCodigo={tiposCodigo}
          value={data.codigos}
          onChange={() => {}}
          disabled
        />

        {data.composto && (
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl font-[590] tracking-[-0.028125rem] leading-[1.5625rem] text-ink-strong m-0">Insumos</h3>
            <DataTable columns={insumoColumns} data={insumos} actions={insumoActions} idField="descricao" pageSize={5} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="font-sans text-base font-normal text-ink-strong leading-[1.4]">Foto</label>
          <input className={INPUT_CLASS} value={data.foto_url ?? ""} placeholder="Sem imagem" readOnly tabIndex={-1} />
          {data.foto_url && (
            <img
              src={data.foto_url}
              alt="Pré-visualização"
              className="mt-2 max-w-40 max-h-40 rounded-lg object-cover"
            />
          )}
        </div>

        <div className="flex justify-end gap-[10px] pt-1">
          <Button label="Fechar" variant="cancel" onClick={onClose} />
        </div>
      </div>

      <Modal
        open={insumoViewData !== null}
        onClose={() => setInsumoViewData(null)}
        width="728px"
      >
        {insumoViewData && (
          <ProdutoView
            conversoes={conversoes}
            tiposCodigo={tiposCodigo}
            data={insumoViewData}
            onClose={() => setInsumoViewData(null)}
          />
        )}
      </Modal>
    </>
  );
}
