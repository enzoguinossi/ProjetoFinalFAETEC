/**
 * De onde cada componente vem no código.
 *
 * Esta tabela é a **âncora** das duas direções:
 *
 *   app → Figma  a descrição de cada mestre recebe `Origem: <arquivo>#<Componente>`,
 *                então o designer vê onde aquilo vive no código;
 *   Figma → app  `figma:diff` usa a mesma tabela para dizer em qual arquivo mexer
 *                quando o design mudou.
 *
 * Fonte única: o manifesto (`scenes.json`) leva a tabela para o plugin, e o
 * `diff.ts` a importa daqui — nenhum dos dois mantém uma cópia própria.
 *
 * Ao marcar um componente novo com `data-figma`, acrescente-o aqui; sem entrada
 * o mestre ainda é criado, mas a descrição sai como `(não mapeada)`.
 */
export const ORIGEM: Record<string, string> = {
  Button: "src/components/Button.tsx",
  PageButton: "src/components/TablePagination.tsx",
  SearchBar: "src/components/SearchBar.tsx",
  TableHeader: "src/components/DataTable.tsx",
  TableRow: "src/components/DataTable.tsx",
  DataTable: "src/components/DataTable.tsx",
  TablePagination: "src/components/TablePagination.tsx",
  Modal: "src/components/Modal.tsx",
  ConfirmDialog: "src/components/ConfirmDialog.tsx",
  Aviso: "src/components/Aviso.tsx",
  Sidebar: "src/components/Sidebar.tsx",
  SidebarItem: "src/components/Sidebar.tsx",
  SidebarGroup: "src/components/Sidebar.tsx",
  SidebarSubItem: "src/components/Sidebar.tsx",
  AppShell: "src/components/DashboardLayout.tsx",
  AppBar: "src/components/DashboardLayout.tsx",
  FormularioUsuario: "src/app/usuarios/novo/UsuarioForm.tsx",
  FormularioFuncionario: "src/app/funcionarios/novo/FuncionarioForm.tsx",
  FormularioDestinatario: "src/app/destinatarios/novo/DestinatarioForm.tsx",
  FormularioFornecedor: "src/app/fornecedores/novo/FornecedorForm.tsx",
  FormularioVeiculo: "src/app/veiculos/novo/VeiculoForm.tsx",
  FormularioProduto: "src/app/produtos/novo/ProdutoForm.tsx",
  FormularioPerfil: "src/app/perfis/novo/PerfilForm.tsx",
};
