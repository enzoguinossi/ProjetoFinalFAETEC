"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { codigo: "001", razao: "EMEI Tia Nastácia" },
  { codigo: "002", razao: "EMEF Professora Maria José" },
  { codigo: "003", razao: "Creche Bem-Querer" },
];

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "razao" as const, label: "Razão Social", width: "5fr" },
];

export default function DestinatariosPage() {
  return (
    <DashboardLayout title="Destinatários">
      <SearchBar placeholder="Pesquisar destinatários..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo} />
    </DashboardLayout>
  );
}