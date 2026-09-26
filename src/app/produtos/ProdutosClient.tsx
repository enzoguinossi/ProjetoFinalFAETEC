"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ProdutoForm from "./novo/ProdutoForm";
import type { Column } from "@/components/DataTable";

interface ProdutoRow extends Record<string, unknown> {
  codigo: string;
  descricao: string;
  qtd: string;
  livre: string;
}

interface Props {
  rows: ProdutoRow[];
  conversoes: { id_conversao: number; nome: string }[];
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
}

const columns: Column<ProdutoRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "qtd", label: "Quantidade", width: "1fr" },
  { key: "livre", label: "Qtd. Livre", width: "1fr" },
];

export default function ProdutosClient({ rows, conversoes, tiposCodigo }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
        onNew={() => setModalOpen(true)}
      />
      <DataTable columns={columns} data={rows} idField="codigo" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Cadastro de Produto"
        width="728px"
      >
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          onSuccess={() => {
            setModalOpen(false);
            // refresh: soft-reload for now, can be refined later
            window.location.reload();
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </>
  );
}