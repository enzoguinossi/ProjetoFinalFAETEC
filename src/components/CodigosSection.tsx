"use client";

import { useState } from "react";
import DataTable from "@/components/DataTable";
import CodigoForm from "@/components/CodigoForm";
import Button from "@/components/Button";

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
}

const columns = [
  { key: "tipo" as const, label: "Tipo", width: "1.5fr" },
  { key: "valor" as const, label: "Código", width: "2fr" },
];

export default function CodigosSection({
  tiposCodigo,
  value,
  onChange,
  disabled = false,
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
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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

      {value.map((c, i) => (
        <div key={`hc-${i}`} className="hidden">
          <input name="codigo_tipo" value={c.tipo} readOnly />
          <input name="codigo_valor" value={c.valor} readOnly />
        </div>
      ))}

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
    </div>
  );
}
