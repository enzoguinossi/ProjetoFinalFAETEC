export type SidebarUser = {
  id_usuario: number;
  nome: string;
  login: string;
  super_admin: boolean;
  permissoes: string[];
};

export const cadastroItems = [
  { label: "Usuários", path: "/usuarios", icon: "/icons/cadastros/usuario.svg", permissao: "usuario.listar" },
  { label: "Funcionários", path: "/funcionarios", icon: "/icons/cadastros/funcionarios.svg", permissao: "funcionario.listar" },
  { label: "Destinatários", path: "/destinatarios", icon: "/icons/cadastros/escola.svg", permissao: "destinatario.listar" },
  { label: "Produtos", path: "/produtos", icon: "/icons/cadastros/produto.svg", permissao: "produto.listar" },
  { label: "Fornecedores", path: "/fornecedores", icon: "/icons/nav/dados.svg", permissao: "fornecedor.listar" },
  { label: "Veículos", path: "/veiculos", icon: "/icons/cadastros/carro.svg", permissao: "veiculo.listar" },
];

export const movEstoqueItems = [
  { label: "Entrada", path: "/mov-estoque/entrada", icon: "/icons/nav/estoque.svg", permissao: "estoque.entrada" },
  { label: "Saída", path: "/mov-estoque/saida", icon: "/icons/nav/estoque.svg", permissao: "estoque.saida" },
];

export const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "/icons/nav/dashboard.svg" },
  { label: "Pedidos", path: "/pedidos", icon: "/icons/nav/dados.svg" },
  { label: "Relatórios", path: "/relatorios", icon: "/icons/nav/estoque.svg" },
];

export const sidebarCls =
  "w-[var(--sidebar-width)] h-screen bg-white flex flex-col shrink-0 sticky top-0 border-r border-border gap-4 py-6 px-4 box-border";
export const logoAreaCls = "flex justify-center items-center w-full";
export const buttonGroupCls = "flex justify-center gap-4 w-full";
export const iconBtnCls =
  "w-12 h-12 flex items-center justify-center border-none rounded-lg bg-transparent cursor-pointer transition-[background-color] duration-[120ms] hover:bg-[#f2f4f8] [&_img]:w-6 [&_img]:h-6";
export const navCls = "flex-1 flex flex-col min-h-0 w-full";
export const navItemCls =
  "flex items-center gap-2 w-full h-12 py-3 px-2 border-b border-[#f2f4f8] bg-transparent cursor-pointer font-sans text-base leading-none font-medium text-ink text-left transition-[background-color] duration-[120ms] box-border hover:bg-[#f2f4f8]";
export const navItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]! border-b-transparent";
export const subItemsCls = "flex flex-col pl-2";
export const subItemCls =
  "flex items-center gap-2 w-full py-2 px-3 border-none bg-transparent cursor-pointer font-sans text-sm font-normal text-ink text-left transition-[background-color] duration-[120ms] rounded-md box-border hover:bg-[#f2f4f8]";
export const subItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]!";
export const userInfoCls =
  "flex items-center gap-[0.625rem] w-full pt-2 border-t border-border bg-transparent border-l-0 border-r-0 border-b-0 cursor-pointer font-[inherit] text-left";
