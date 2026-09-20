"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const columns = [
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "placa" as const, label: "Placa", width: "1.5fr" },
  { key: "status" as const, label: "Status", width: "1fr" },
];

export default function VeiculosPage() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/veiculos")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Veículos">
      <SearchBar placeholder="Pesquisar veículos..." />
      {loading ? (
        <p style={{ padding: "1rem", color: "#697077" }}>Carregando...</p>
      ) : (
        <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.placa as string} />
      )}
    </DashboardLayout>
  );
}