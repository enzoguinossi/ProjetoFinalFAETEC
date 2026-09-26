"use client";

import { useEffect, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import ProdutoForm from "./novo/ProdutoForm";
import type { Column } from "@/components/DataTable";
import { searchProdutosList, type ProdutoListRow } from "./actions";

interface Props {
  rows: ProdutoListRow[];
  conversoes: { id_conversao: number; nome: string }[];
  tiposCodigo: { id_tipo_codigo: number; nome: string }[];
}

const columns: Column<ProdutoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "qtd", label: "Quantidade", width: "1fr" },
  { key: "livre", label: "Qtd. Livre", width: "1fr" },
];

export default function ProdutosClient({ rows: initialRows, conversoes, tiposCodigo }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [rows, setRows] = useState(initialRows);
  const searchRef = useRef("");

  useEffect(() => {
    if (searchRef.current.length < 2) {
      setRows(initialRows);
    }
  }, [initialRows]);

  function handleSearch(value: string) {
    searchRef.current = value;
    if (value.length < 2) {
      setRows(initialRows);
      return;
    }
    searchProdutosList(value).then(setRows).catch(() => setRows(initialRows));
  }

  return (
    <>
      <SearchBar
        placeholder="Pesquisar produtos..."
        onNew={() => setModalOpen(true)}
        onSearch={handleSearch}
      />
      <DataTable columns={columns} data={rows} idField="codigo" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        width="728px"
      >
        <ProdutoForm
          conversoes={conversoes}
          tiposCodigo={tiposCodigo}
          onSuccess={() => {
            setModalOpen(false);
            window.location.reload();
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </>
  );
}