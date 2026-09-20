"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { codigo: "001", nome: "Gabriel Pereira", cnh: "SP 123456789" },
  { codigo: "002", nome: "Thiago Almeida", cnh: "RJ 987654321" },
];

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "nome" as const, label: "Nome", width: "2fr" },
  { key: "cnh" as const, label: "CNH", width: "3fr" },
];

export default function CondutoresPage() {
  return (
    <DashboardLayout title="Condutores">
      <SearchBar placeholder="Pesquisar condutores..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo} />
    </DashboardLayout>
  );
}