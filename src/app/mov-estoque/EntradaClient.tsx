"use client";

import { useState } from "react";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult } from "@/types";
import EntradaForm from "./EntradaForm";
import { listarNotasEntrada } from "./actions";
import type { ConversaoUnidadeItem, NotaEntradaListRow } from "./tipos";

interface Props {
  inicial: PaginatedResult<NotaEntradaListRow>;
  conversoes: ConversaoUnidadeItem[];
  podeCriar: boolean;
}

const columnsEntrada: Column<NotaEntradaListRow>[] = [
  { key: "data", label: "Data", width: "1fr", align: "left" },
  { key: "fornecedor", label: "Fornecedor", width: "2fr", align: "left" },
  { key: "itens", label: "Itens", width: "0.7fr", align: "right" },
  {
    key: "chavesTexto",
    label: "Chaves de acesso",
    width: "3fr",
    align: "left",
    render: (_valor, row) => (
      <span title={row.chaves.join(", ")}>{row.chavesTexto}</span>
    ),
  },
];

export default function EntradaClient({ inicial, conversoes, podeCriar }: Props) {
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar(page = 1, limit = resultado.limit) {
    setCarregando(true);
    try {
      const atualizado = await listarNotasEntrada({ page, limit });
      setResultado(atualizado);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-[590] text-ink-strong">Notas de entrada</h2>
        {podeCriar ? (
          <Button
            label="Nova entrada"
            iconLeft={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            onClick={() => setModalAberto(true)}
          />
        ) : (
          <span className="font-sans text-sm text-[#697077]">
            Seu usuário não tem permissão para registrar entradas.
          </span>
        )}
      </div>

      <DataTable
        columns={columnsEntrada}
        data={resultado.data}
        idField="id_nota_entrada"
        paginacaoServidor={{
          total: resultado.total,
          page: resultado.page,
          pageSize: resultado.limit,
          onPageChange: (page) => void carregar(page, resultado.limit),
          onPageSizeChange: (limit) => void carregar(1, limit),
        }}
        carregando={carregando}
      />

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Nova entrada" width="960px">
        <EntradaForm
          conversoes={conversoes}
          onCancel={() => setModalAberto(false)}
          onSaved={async () => {
            setModalAberto(false);
            await carregar(1);
          }}
        />
      </Modal>
    </div>
  );
}
