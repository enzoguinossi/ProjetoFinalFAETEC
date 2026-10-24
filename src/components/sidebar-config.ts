import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Car,
  ChartColumn,
  ClipboardList,
  Database,
  IdCard,
  LayoutDashboard,
  MapPinned,
  Package,
  PackageMinus,
  PackagePlus,
  Route,
  School,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

export type SidebarUser = {
  id_usuario: number;
  nome: string;
  login: string;
  super_admin: boolean;
  permissoes: string[];
};

export type SidebarNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export type SidebarNavItemWithPermission = SidebarNavItem & {
  permissao: string;
};

export const cadastroItems: SidebarNavItemWithPermission[] = [
  { label: "Usuários", path: "/usuarios", icon: Users, permissao: "usuario.listar" },
  { label: "Funcionários", path: "/funcionarios", icon: IdCard, permissao: "funcionario.listar" },
  { label: "Destinatários", path: "/destinatarios", icon: School, permissao: "destinatario.listar" },
  { label: "Produtos", path: "/produtos", icon: Package, permissao: "produto.listar" },
  { label: "Fornecedores", path: "/fornecedores", icon: Building2, permissao: "fornecedor.listar" },
  { label: "Veículos", path: "/veiculos", icon: Car, permissao: "veiculo.listar" },
];

export const movEstoqueItems: SidebarNavItemWithPermission[] = [
  { label: "Entrada", path: "/mov-estoque/entrada", icon: PackagePlus, permissao: "estoque.entrada" },
  { label: "Saída", path: "/mov-estoque/saida", icon: PackageMinus, permissao: "estoque.saida" },
];

export const expedicaoItems: SidebarNavItemWithPermission[] = [
  { label: "Expedições", path: "/expedicoes", icon: MapPinned, permissao: "expedicao.listar" },
  { label: "Percursos", path: "/expedicoes/percursos", icon: Route, permissao: "percurso.listar" },
];

// Ordem do menu: Dashboard · Mov. Estoque · Expedições · Cadastros · Pedidos · Relatórios.
export const navTopItems: SidebarNavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
];

export const navBottomItems: SidebarNavItem[] = [
  { label: "Pedidos", path: "/pedidos", icon: ClipboardList },
  { label: "Relatórios", path: "/relatorios", icon: ChartColumn },
];

export const navItems: SidebarNavItem[] = [...navTopItems, ...navBottomItems];

export const movEstoqueGroup: { label: string; icon: LucideIcon } = {
  label: "Mov. Estoque",
  icon: Warehouse,
};

export const expedicoesGroup: { label: string; icon: LucideIcon } = {
  label: "Expedições",
  icon: Truck,
};

export const cadastrosGroup: { label: string; icon: LucideIcon } = {
  label: "Cadastros",
  icon: Database,
};

// Base sem largura: o modo (expandido ou rail) decide `w-*` e o overflow.
export const sidebarCls =
  "h-screen bg-white flex flex-col shrink-0 sticky top-0 border-r border-border py-3 box-border transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export const sidebarExpandedCls =
  "w-[var(--sidebar-width)] px-2 overflow-hidden";

// Rail: só os ícones. `overflow-visible` deixa o menu do usuário escapar da rail.
export const sidebarCollapsedCls = "w-[72px] px-2 overflow-visible";

export const headerCls = "shrink-0 flex flex-col items-center gap-2 w-full";
export const logoAreaCls = "flex justify-center items-center w-full";
export const buttonGroupCls = "flex justify-center gap-1 w-full";
export const buttonGroupCollapsedCls = "flex flex-col items-center gap-1 w-full";
export const iconBtnCls =
  "w-9 h-9 flex items-center justify-center border-none rounded-lg bg-transparent cursor-pointer text-[#697077] transition-colors duration-150 hover:bg-[#f2f4f8] hover:text-[#001d6c]";

export const navCls =
  "flex-1 min-h-0 w-full flex flex-col gap-1 overflow-y-auto overflow-x-hidden py-1 px-1 [scrollbar-width:thin] [scrollbar-color:#dde1e6_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#dde1e6]";

export const navItemCls =
  "flex items-center w-full h-10 py-0 border-none bg-transparent cursor-pointer font-sans text-sm leading-none font-medium text-ink text-left rounded-lg transition-colors duration-150 box-border hover:bg-[#f2f4f8]";
export const navItemExpandedCls = "gap-2 px-2";
export const navItemCollapsedCls = "justify-center px-0";
export const navItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]!";
export const navItemIconCls = "w-[18px] h-[18px] shrink-0";
export const navItemIconInactiveCls = "text-[#697077]";
export const navChevronCls = "shrink-0 ml-auto transition-transform duration-150";

export const subItemsCls = "flex flex-col gap-0.5 pl-2";
export const subItemCls =
  "flex items-center gap-2 w-full h-9 py-0 pl-2 pr-2 border-none bg-transparent cursor-pointer font-sans text-sm font-normal text-ink text-left rounded-lg transition-colors duration-150 box-border hover:bg-[#f2f4f8]";
export const subItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]!";

export const userInfoBaseCls =
  "shrink-0 flex items-center w-full pt-2 border-t border-border bg-transparent border-l-0 border-r-0 border-b-0 cursor-pointer font-[inherit] text-left";

export const userInfoCls = `${userInfoBaseCls} gap-[0.625rem]`;

// Rail: só o avatar, centralizado.
export const userInfoCollapsedCls = `${userInfoBaseCls} justify-center`;

const userMenuBaseCls =
  "absolute bottom-full mb-2 bg-white border border-[#dde1e6] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] overflow-hidden z-[100]";

export const userMenuCls = `${userMenuBaseCls} left-0 right-0`;

// Fora da rail (56px úteis) o menu precisa de largura própria para não esmagar.
export const userMenuCollapsedCls = `${userMenuBaseCls} left-0 w-56`;
