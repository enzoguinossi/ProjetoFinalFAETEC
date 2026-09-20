import type { Action } from "@/components/DataTable";

export const tableActions: Action<Record<string, unknown>>[] = [
  {
    icon: "/icons/actions/Editar.svg",
    label: "Editar",
    onClick: (row) => console.log("Edit", row),
  },
  {
    icon: "/icons/actions/Olho.svg",
    label: "Visualizar",
    onClick: (row) => console.log("View", row),
  },
  {
    icon: "/icons/actions/Lixeira.svg",
    label: "Excluir",
    onClick: (row) => console.log("Delete", row),
  },
];