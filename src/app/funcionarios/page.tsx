"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const data = [
  { codigo: "001", nome: "João Ruan Oliveira", cargo: "Operador" },
  { codigo: "002", nome: "Diego Santos", cargo: "Aux. Administrativo" },
  { codigo: "003", nome: "Gabriel Pereira", cargo: "Condutor" },
];

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "nome" as const, label: "Nome", width: "3fr" },
  { key: "cargo" as const, label: "Cargo", width: "2fr" },
];

export default function FuncionariosPage() {
  return (
    <DashboardLayout title="Funcionários">
      <SearchBar placeholder="Pesquisar funcionários..." />
      <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo} />
    </DashboardLayout>
  );
}