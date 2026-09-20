"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { descricao: "Fiorino Branco", placa: "ABC-1234", status: "Ativo" },
  { descricao: "Kombi Azul", placa: "DEF-5678", status: "Em manutenção" },
  { descricao: "SUV Preto", placa: "GHI-9012", status: "Ativo" },
];

const columns = [
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "placa" as const, label: "Placa", width: "1.5fr" },
  { key: "status" as const, label: "Status", width: "1fr" },
];

export default function VeiculosPage() {
  return (
    <DashboardLayout title="Veículos">
      <SearchBar placeholder="Pesquisar veículos..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.placa} />
    </DashboardLayout>
  );
}