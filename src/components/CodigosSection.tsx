"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import CodigoForm from "@/components/CodigoForm";
import Button from "@/components/Button";
import CompactList, { type CompactListAction } from "@/components/form/CompactList";

export type CodigoEntry = { tipo: string; valor: string };

interface TipoCodigo {
  id_tipo_codigo: number;
  nome: string;
}

interface Props {
  tiposCodigo: TipoCodigo[];
  value: CodigoEntry[];
  onChange: (next: CodigoEntry[]) => void;
  disabled?: boolean;
  /**
   * `table` = tabela usada pelos demais cadastros (padrão).
   * `compact` = lista compacta dentro da ficha do produto (sem `DataTable`).
   */
  variant?: "table" | "compact";
}

const columns = [
  { key: "tipo" as const, label: "Tipo", width: "1.5fr", align: "left" as const },
  { key: "valor" as const, label: "Código", width: "2fr", align: "center" as const },
];

/** Lista compacta da ficha: sem título próprio (a seção fornece o título). */
const colunasCompactas = [
  {
    key: "tipo",
    label: "Tipo",
    width: "1.4fr",
    render: (codigo: CodigoEntry) => codigo.tipo,
  },
  {
    key: "valor",
    label: "Código",
    width: "2fr",
    render: (codigo: CodigoEntry) => codigo.valor,
  },
];

export default function CodigosSection({
  tiposCodigo,
  value,
  onChange,
  disabled = false,
  variant = "table",
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);

  function iniciarNovo() {
    setEditandoIdx(null);
    setModalOpen(true);
  }

  function confirmar(tipo: string, valor: string) {
    if (editandoIdx !== null && editandoIdx < value.length) {
      const next = [...value];
      next[editandoIdx] = { tipo, valor };
      onChange(next);
    } else {
      onChange([...value, { tipo, valor }]);
    }
    setModalOpen(false);
  }

  function remover(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function indiceDe(codigo: CodigoEntry): number {
    return value.findIndex(
      (c) => c.valor === codigo.valor && c.tipo === codigo.tipo,
    );
  }

  const actions = disabled
    ? undefined
    : [
        {
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (row: Record<string, unknown>) => {
            const i = value.findIndex((c) => c.valor === row.valor && c.tipo === row.tipo);
            if (i >= 0) {
              setEditandoIdx(i);
              setModalOpen(true);
            }
          },
        },
        {
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (row: Record<string, unknown>) => {
            const i = value.findIndex((c) => c.valor === row.valor && c.tipo === row.tipo);
            if (i >= 0) remover(i);
          },
        },
      ];

  const acoesCompactas: CompactListAction<CodigoEntry>[] | undefined = disabled
    ? undefined
    : [
        {
          icon: "/icons/actions/Editar.svg",
          label: "Editar",
          onClick: (codigo) => {
            const i = indiceDe(codigo);
            if (i >= 0) {
              setEditandoIdx(i);
              setModalOpen(true);
            }
          },
        },
        {
          icon: "/icons/actions/Lixeira.svg",
          label: "Excluir",
          onClick: (codigo) => {
            const i = indiceDe(codigo);
            if (i >= 0) remover(i);
          },
        },
      ];

  const formularioCodigo = (
    <CodigoForm
      key={editandoIdx ?? "novo"}
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      onConfirm={confirmar}
      tiposCodigo={tiposCodigo}
      initialTipo={editandoIdx !== null ? value[editandoIdx]?.tipo : undefined}
      initialValor={editandoIdx !== null ? value[editandoIdx]?.valor : ""}
      editing={editandoIdx !== null}
    />
  );

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-2">
        <CompactList
          items={value}
          columns={colunasCompactas}
          rowKey={(codigo) => `${codigo.tipo}:${codigo.valor}`}
          actions={acoesCompactas}
          onAdd={disabled ? undefined : { label: "Novo código", onClick: iniciarNovo }}
          empty="Nenhum código cadastrado."
          search={(codigo) => `${codigo.tipo} ${codigo.valor}`}
          searchPlaceholder="Buscar código..."
          noun={{ singular: "código", plural: "códigos" }}
        />
        {formularioCodigo}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3
          className="m-0 font-display text-xl font-[590] leading-[1.5625rem] tracking-[-0.028125rem] text-ink-strong"
        >
          Códigos Personalizados
        </h3>
        {!disabled && (
          <Button
            label="Novo"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" data-figma-icon="Adicionar">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={iniciarNovo}
          />
        )}
      </div>

      <DataTable
        columns={columns}
        data={value}
        actions={actions}
        idField="valor"
        pageSize={5}
      />

      {formularioCodigo}
    </div>
  );
}
