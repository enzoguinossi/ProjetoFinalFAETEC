"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "razao" as const, label: "Razão Social", width: "5fr" },
];

export default function FornecedoresPage() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fornecedores")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Fornecedores">
      <SearchBar placeholder="Pesquisar fornecedores..." />
      {loading ? (
        <p style={{ padding: "1rem", color: "#697077" }}>Carregando...</p>
      ) : (
        <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo as string} />
      )}
    </DashboardLayout>
  );
}