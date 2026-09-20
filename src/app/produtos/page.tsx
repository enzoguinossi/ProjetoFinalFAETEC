import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { produtoDAO } from "@/dao/produto";

export default async function ProdutosPage() {
  const { data } = await produtoDAO.list();

  const rows = data.map((p, i) => ({
    codigo: String(i + 1).padStart(6, "0"),
    descricao: p.descricao,
    qtd: "0",
    livre: "0",
  }));

  return (
    <DashboardLayout title="Produtos">
      <SearchBar placeholder="Pesquisar produtos..." />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "qtd" as const, label: "Quantidade", width: "1fr" },
  { key: "livre" as const, label: "Qtd. Livre", width: "1fr" },
];