import type { Action } from "@/components/DataTable";

const log = (label: string) => (i: number) => console.log(label, i);

export const tableActions: Action[] = [
  { icon: "icons/actions/editar.svg", label: "Editar", onClick: log("Edit") },
  { icon: "icons/actions/olho.svg", label: "Visualizar", onClick: log("View") },
  { icon: "icons/actions/lixeira.svg", label: "Excluir", onClick: log("Delete")},
];