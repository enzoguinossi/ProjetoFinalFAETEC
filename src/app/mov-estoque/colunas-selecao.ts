import type { Column } from "@/components/DataTable";
import type { DestinatarioSelecaoRow, FornecedorSelecaoRow } from "./tipos";

export const COLUNAS_FORNECEDOR: Column<FornecedorSelecaoRow>[] = [
  { key: "razao_social", label: "Razão social", width: "3fr", align: "left" },
  {
    key: "cnpj",
    label: "CNPJ",
    width: "1.2fr",
    render: (value) => (value ? String(value) : "—"),
  },
];

const ROTULOS_TIPO_DESTINATARIO: Record<string, string> = {
  ESCOLA: "Escola",
  CRECHE: "Creche",
};

export const COLUNAS_DESTINATARIO: Column<DestinatarioSelecaoRow>[] = [
  { key: "razao_social", label: "Razão social", width: "3fr", align: "left" },
  {
    key: "tipo",
    label: "Tipo",
    width: "1fr",
    align: "center",
    render: (value) => ROTULOS_TIPO_DESTINATARIO[String(value)] ?? String(value),
  },
];
