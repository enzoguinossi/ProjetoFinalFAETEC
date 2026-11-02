import type { Column } from "@/components/DataTable";
import { formatarCnpj } from "@/lib/cnpj";
import { ROTULOS_TIPO_DESTINATARIO, type TipoDestinatario } from "@/types";
import type { DestinatarioSelecaoRow, FornecedorSelecaoRow } from "./tipos";

export const COLUNAS_FORNECEDOR: Column<FornecedorSelecaoRow>[] = [
  { key: "razao_social", label: "Razão social", width: "3fr", align: "left" },
  {
    key: "cnpj",
    label: "CNPJ",
    width: "1.2fr",
    render: (value) => (value ? formatarCnpj(String(value)) : "—"),
  },
];

export const COLUNAS_DESTINATARIO: Column<DestinatarioSelecaoRow>[] = [
  { key: "razao_social", label: "Razão social", width: "3fr", align: "left" },
  {
    key: "tipo",
    label: "Tipo",
    width: "1fr",
    align: "center",
    render: (value) =>
      ROTULOS_TIPO_DESTINATARIO[value as TipoDestinatario] ?? String(value),
  },
];
