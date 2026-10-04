"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserInfo } from "@/app/actions/user";
import { logoutAction } from "@/app/login/actions";

// Cache o módulo para evitar recarregar a cada navegação
type SidebarUser = {
  id_usuario: number;
  nome: string;
  login: string;
  super_admin: boolean;
  permissoes: string[];
};
let cachedUser: SidebarUser | null = null;
let cachePromise: Promise<typeof cachedUser> | null = null;

function loadUser() {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (cachePromise) return cachePromise;
  cachePromise = (getUserInfo() as Promise<typeof cachedUser>).then((u) => {
    cachedUser = u;
    cachePromise = null;
    return u;
  });
  return cachePromise;
}

const cadastroItems = [
  { label: "Usuários", path: "/usuarios", icon: "/icons/cadastros/usuario.svg", permissao: "usuario.listar" },
  { label: "Funcionários", path: "/funcionarios", icon: "/icons/cadastros/funcionarios.svg", permissao: "funcionario.listar" },
  { label: "Destinatários", path: "/destinatarios", icon: "/icons/cadastros/escola.svg", permissao: "destinatario.listar" },
  { label: "Produtos", path: "/produtos", icon: "/icons/cadastros/produto.svg", permissao: "produto.listar" },
  { label: "Fornecedores", path: "/fornecedores", icon: "/icons/nav/dados.svg", permissao: "fornecedor.listar" },
  { label: "Veículos", path: "/veiculos", icon: "/icons/cadastros/carro.svg", permissao: "veiculo.listar" },
];

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "/icons/nav/dashboard.svg" },
  { label: "Mov. Estoque", path: "/mov-estoque", icon: "/icons/nav/estoque.svg" },
  { label: "Pedidos", path: "/pedidos", icon: "/icons/nav/dados.svg" },
  { label: "Relatórios", path: "/relatorios", icon: "/icons/nav/estoque.svg" },
];

const sidebarCls =
  "w-[var(--sidebar-width)] h-screen bg-white flex flex-col shrink-0 sticky top-0 border-r border-border gap-4 py-6 px-4 box-border";
const logoAreaCls = "flex justify-center items-center w-full";
const buttonGroupCls = "flex justify-center gap-4 w-full";
const iconBtnCls =
  "w-12 h-12 flex items-center justify-center border-none rounded-lg bg-transparent cursor-pointer transition-[background-color] duration-[120ms] hover:bg-[#f2f4f8] [&_img]:w-6 [&_img]:h-6";
const navCls = "flex-1 flex flex-col min-h-0 w-full";
const navItemCls =
  "flex items-center gap-2 w-full h-12 py-3 px-2 border-b border-[#f2f4f8] bg-transparent cursor-pointer font-[Roboto,sans-serif] text-base leading-none font-medium text-ink text-left transition-[background-color] duration-[120ms] box-border hover:bg-[#f2f4f8]";
const navItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]! border-b-transparent";
const subItemsCls = "flex flex-col pl-2";
const subItemCls =
  "flex items-center gap-2 w-full py-2 px-3 border-none bg-transparent cursor-pointer font-[Roboto,sans-serif] text-sm font-normal text-ink text-left transition-[background-color] duration-[120ms] rounded-md box-border hover:bg-[#f2f4f8]";
const subItemActiveCls = "bg-[#e8f0fe]! text-[#001d6c]!";
const userInfoCls =
  "flex items-center gap-[0.625rem] w-full pt-2 border-t border-border bg-transparent border-l-0 border-r-0 border-b-0 cursor-pointer font-[inherit] text-left";

export default function Sidebar() {
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<typeof cachedUser>(cachedUser);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    loadUser().then((u) => { if (u) setUser(u); });
  }, []);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  async function handleLogout() {
    cachedUser = null;
    cachePromise = null;
    await logoutAction();
    router.push("/login");
  }

  const initial = user?.nome?.charAt(0).toUpperCase() ?? "?";

  const navigate = (path: string) => router.push(path);

  const isActive = (path: string) => pathname === path;
  const isCadastroItemActive = cadastroItems.some((i) => pathname === i.path);

  const visibleCadastroItems = user?.super_admin
    ? cadastroItems
    : cadastroItems.filter((i) => user?.permissoes?.includes(i.permissao));

  return (
    <aside className={sidebarCls}>
      {/* Logo */}
      <div className={logoAreaCls}>
        <img src="/logo.svg" alt="Nexus" className="w-[70.69px] h-auto" />
      </div>

      {/* Botões de ação */}
      <div className={buttonGroupCls}>
        <button className={iconBtnCls}>
          <img src="/icons/actions/config.svg" alt="Configurações" />
        </button>
        <button className={iconBtnCls}>
          <img src="/icons/actions/sino.svg" alt="Notificações" />
        </button>
      </div>

      {/* Menu */}
      <nav className={navCls}>
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`${navItemCls} ${isActive(item.path) ? navItemActiveCls : ""}`}
            onClick={() => navigate(item.path)}
          >
            <img src={item.icon} alt="" className="w-6 h-6 shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}

        {/* Cadastros (collapsible) */}
        <div>
          <button
            className={`${navItemCls} ${isCadastroItemActive ? navItemActiveCls : ""}`}
            onClick={() => setCadastrosOpen(!cadastrosOpen)}
          >
            <img src="/icons/nav/cadastros.svg" alt="" className="w-6 h-6 shrink-0" />
            <span>Cadastros</span>
            <img
              src={cadastrosOpen ? "/icons/arrows/seta-aberta.svg" : "/icons/arrows/seta-fechada.svg"}
              alt=""
              className="w-3 h-3 shrink-0 ml-auto transition-transform duration-200 opacity-60"
              style={{ transform: cadastrosOpen ? "rotate(0)" : "rotate(-90deg)" }}
            />
          </button>

          {cadastrosOpen && (
            <div className={subItemsCls}>
              {visibleCadastroItems.map((item) => (
                <button
                  key={item.path}
                  className={`${subItemCls} ${isActive(item.path) ? subItemActiveCls : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <img src={item.icon} alt="" className="w-5 h-5 shrink-0 opacity-70" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Informações do Usuário */}
      <div className="relative w-full" ref={menuRef}>
        <button
          className={userInfoCls}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className="w-12 h-12 rounded-full bg-[#f2f4f8] flex items-center justify-center font-sans text-sm font-semibold text-[#001d6c] shrink-0">
            {initial}
          </div>
          <span className="font-sans text-xs text-black">{user?.nome ?? "Carregando..."}</span>
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#dde1e6] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] overflow-hidden z-[100]">
            <div className="flex flex-col gap-[2px] p-3">
              <span className="font-sans text-[0.8125rem] font-semibold text-ink">{user?.nome}</span>
              <span className="font-sans text-xs text-[#697077]">{user?.login}</span>
              {user?.super_admin && (
                <span className="font-sans text-[0.6875rem] font-semibold text-brand bg-[rgba(27,153,86,0.08)] px-[6px] py-[2px] rounded-[4px] self-start mt-1">
                  Admin
                </span>
              )}
            </div>
            <hr className="border-t border-[#e2e2e2] m-0" />
            <button
              className="flex items-center gap-2 w-full px-3 py-[0.625rem] border-none bg-transparent cursor-pointer font-sans text-[0.8125rem] text-danger text-left transition-[background-color] duration-[120ms] hover:bg-danger-bg"
              onClick={handleLogout}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
