"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { tableActions } from "@/lib/table-actions";

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "qtd" as const, label: "Quantidade", width: "1fr" },
  { key: "livre" as const, label: "Qtd. Livre", width: "1fr" },
];

export default function ProdutosPage() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/produtos")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Produtos">
      <SearchBar placeholder="Pesquisar produtos..." />
      {loading ? (
        <p style={{ padding: "1rem", color: "#697077" }}>Carregando...</p>
      ) : (
        <DataTable columns={columns} data={data} actions={tableActions} keyExtractor={(r) => r.codigo as string} />
      )}
    </DashboardLayout>
  );
}