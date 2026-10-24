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

// Base sem largura: a largura vem da coluna do grid do `DashboardLayout`
// (256px aberta / 72px recolhida), que é quem anima a transição.
// `w-full h-full` preenche a célula; o modo decide só padding e overflow.
export const sidebarCls =
  "w-full h-full min-h-0 bg-white flex flex-col shrink-0 border-r border-border py-3 box-border";

export const sidebarExpandedCls = "px-2 overflow-hidden";

// Rail: só os ícones. `overflow-visible` deixa o conteúdo escapar da rail.
export const sidebarCollapsedCls = "px-2 overflow-visible";

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

/* ---------------------------------------------------------------------------
 * Estado da sidebar persistido em localStorage.
 *
 * Lido como store externo (`useSyncExternalStore`): cada página remonta o
 * `DashboardLayout`, e o store devolve o valor salvo já no primeiro render da
 * navegação no cliente — sem `setState` dentro de efeito e sem divergir do HTML
 * do servidor (que usa o padrão). As mutações são funcionais e gravam antes de
 * notificar, então dois cliques rápidos sempre enxergam o estado mais recente.
 * ------------------------------------------------------------------------- */

export type GrupoSidebar = "mov" | "expedicoes" | "cadastros";
export type GruposSidebar = Record<GrupoSidebar, boolean>;

export const gruposSidebarPadrao: GruposSidebar = {
  mov: true,
  expedicoes: true,
  cadastros: true,
};

function criarStoreLocalStorage<T>(
  chave: string,
  padrao: T,
  decodificar: (bruto: string) => T | null,
  codificar: (valor: T) => string,
) {
  let brutoCache: string | null = null;
  let valorCache: T = padrao;
  let temCache = false;
  const ouvintes = new Set<() => void>();

  const snapshot = (): T => {
    let bruto: string | null = null;
    try {
      bruto = window.localStorage.getItem(chave);
    } catch {
      bruto = null;
    }
    if (!temCache || bruto !== brutoCache) {
      brutoCache = bruto;
      valorCache = bruto ? (decodificar(bruto) ?? padrao) : padrao;
      temCache = true;
    }
    return valorCache;
  };

  const servidor = (): T => padrao;

  const assinar = (ouvinte: () => void) => {
    ouvintes.add(ouvinte);
    const aoMudarArmazenamento = (e: StorageEvent) => {
      if (e.key === null || e.key === chave) ouvinte();
    };
    window.addEventListener("storage", aoMudarArmazenamento);
    return () => {
      ouvintes.delete(ouvinte);
      window.removeEventListener("storage", aoMudarArmazenamento);
    };
  };

  const definir = (atualizar: (atual: T) => T) => {
    const proximo = atualizar(snapshot());
    const bruto = codificar(proximo);
    try {
      window.localStorage.setItem(chave, bruto);
    } catch {
      /* localStorage indisponível: mantém em memória */
    }
    brutoCache = bruto;
    valorCache = proximo;
    temCache = true;
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  return { snapshot, servidor, assinar, definir };
}

export const sidebarRecolhidaStore = criarStoreLocalStorage<boolean>(
  "nexus.sidebar.collapsed",
  false,
  (bruto) => (bruto === "1" ? true : bruto === "0" ? false : null),
  (valor) => (valor ? "1" : "0"),
);

export const sidebarGruposStore = criarStoreLocalStorage<GruposSidebar>(
  "nexus.sidebar.grupos",
  gruposSidebarPadrao,
  (bruto) => {
    try {
      const salvo = JSON.parse(bruto) as Partial<GruposSidebar>;
      return {
        mov: typeof salvo.mov === "boolean" ? salvo.mov : gruposSidebarPadrao.mov,
        expedicoes:
          typeof salvo.expedicoes === "boolean" ? salvo.expedicoes : gruposSidebarPadrao.expedicoes,
        cadastros:
          typeof salvo.cadastros === "boolean" ? salvo.cadastros : gruposSidebarPadrao.cadastros,
      };
    } catch {
      return null;
    }
  },
  (valor) => JSON.stringify(valor),
);
