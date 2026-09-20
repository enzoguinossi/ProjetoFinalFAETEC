"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { codigo: "001", razao: "Distribuidora ABC Ltda." },
  { codigo: "002", razao: "Papelaria do Zé" },
  { codigo: "003", razao: "Alimentos S.A." },
];

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "razao" as const, label: "Razão Social", width: "5fr" },
];

export default function FornecedoresPage() {
  return (
    <DashboardLayout title="Fornecedores">
      <SearchBar placeholder="Pesquisar fornecedores..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo} />
    </DashboardLayout>
  );
}