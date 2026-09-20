"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { codigo: "000001", descricao: "Mesa Verde Professor", qtd: "20", livre: "10" },
  { codigo: "000002", descricao: "Cadeira Verde Professor", qtd: "20", livre: "10" },
  { codigo: "000003", descricao: "Giz Branco", qtd: "50", livre: "30" },
];

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "qtd" as const, label: "Quantidade", width: "1fr" },
  { key: "livre" as const, label: "Qtd. Livre", width: "1fr" },
];

export default function ProdutosPage() {
  return (
    <DashboardLayout title="Produtos">
      <SearchBar placeholder="Pesquisar produtos..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo} />
    </DashboardLayout>
  );
}