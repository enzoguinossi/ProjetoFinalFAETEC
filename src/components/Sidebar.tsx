"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserInfo } from "@/app/actions/user";
import { logoutAction } from "@/app/login/actions";
import {
  cadastroItems,
  expedicaoItems,
  movEstoqueItems,
  navItems,
  sidebarCls,
  logoAreaCls,
  buttonGroupCls,
  iconBtnCls,
  navCls,
  navItemCls,
  navItemActiveCls,
  subItemsCls,
  subItemCls,
  subItemActiveCls,
  userInfoCls,
  type SidebarUser,
} from "@/components/sidebar-config";

// Cache o módulo para evitar recarregar a cada navegação
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

export default function Sidebar() {
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [movEstoqueOpen, setMovEstoqueOpen] = useState(true);
  const [expedicoesOpen, setExpedicoesOpen] = useState(true);
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
  const isMovEstoqueItemActive = movEstoqueItems.some((i) => pathname === i.path);
  const isExpedicaoItemActive = expedicaoItems.some((i) => pathname === i.path);

  const visibleCadastroItems = user?.super_admin
    ? cadastroItems
    : cadastroItems.filter((i) => user?.permissoes?.includes(i.permissao));

  const visibleMovEstoqueItems = user?.super_admin
    ? movEstoqueItems
    : movEstoqueItems.filter((i) => user?.permissoes?.includes(i.permissao));

  const visibleExpedicaoItems = user?.super_admin
    ? expedicaoItems
    : expedicaoItems.filter((i) => user?.permissoes?.includes(i.permissao));

  return (
    <aside
      className={sidebarCls}
      data-figma="Sidebar"
      data-figma-variant={visibleCadastroItems.length > 0 ? "com-cadastros" : "sem-cadastros"}
    >
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
        {navItems.map((item, index) => (
          <Fragment key={item.path}>
            <button
              className={`${navItemCls} ${isActive(item.path) ? navItemActiveCls : ""}`}
              onClick={() => navigate(item.path)}
              data-figma="SidebarItem"
              data-figma-label={item.label}
              data-figma-variant={isActive(item.path) ? "ativo" : "inativo"}
            >
              <img src={item.icon} alt="" className="w-6 h-6 shrink-0" />
              <span>{item.label}</span>
            </button>

            {/* Mov. Estoque (collapsible) — ocupa a posição do antigo item, após Dashboard */}
            {index === 0 && (
              <div>
                <button
                  className={`${navItemCls} ${isMovEstoqueItemActive ? navItemActiveCls : ""}`}
                  onClick={() => setMovEstoqueOpen(!movEstoqueOpen)}
                  data-figma="SidebarGroup"
                  data-figma-label="Mov. Estoque"
                  data-figma-variant={isMovEstoqueItemActive ? "ativo" : "inativo"}
                  data-figma-expanded={movEstoqueOpen ? "true" : "false"}
                >
                  <img src="/icons/nav/estoque.svg" alt="" className="w-6 h-6 shrink-0" />
                  <span>Mov. Estoque</span>
                  <img
                    src={movEstoqueOpen ? "/icons/arrows/seta-aberta.svg" : "/icons/arrows/seta-fechada.svg"}
                    alt=""
                    className="w-3 h-3 shrink-0 ml-auto transition-transform duration-200 opacity-60"
                    style={{ transform: movEstoqueOpen ? "rotate(0)" : "rotate(-90deg)" }}
                  />
                </button>

                {movEstoqueOpen && (
                  <div className={subItemsCls}>
                    {visibleMovEstoqueItems.map((item) => (
                      <button
                        key={item.path}
                        className={`${subItemCls} ${isActive(item.path) ? subItemActiveCls : ""}`}
                        onClick={() => navigate(item.path)}
                        data-figma="SidebarSubItem"
                        data-figma-label={item.label}
                        data-figma-variant={isActive(item.path) ? "ativo" : "inativo"}
                      >
                        <img src={item.icon} alt="" className="w-5 h-5 shrink-0 opacity-70" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Fragment>
        ))}

        {/* Cadastros (collapsible) */}
        <div>
          <button
            className={`${navItemCls} ${isCadastroItemActive ? navItemActiveCls : ""}`}
            onClick={() => setCadastrosOpen(!cadastrosOpen)}
            data-figma="SidebarGroup"
            data-figma-label="Cadastros"
            data-figma-variant={isCadastroItemActive ? "ativo" : "inativo"}
            data-figma-expanded={cadastrosOpen ? "true" : "false"}
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
                  data-figma="SidebarSubItem"
                  data-figma-label={item.label}
                  data-figma-variant={isActive(item.path) ? "ativo" : "inativo"}
                >
                  <img src={item.icon} alt="" className="w-5 h-5 shrink-0 opacity-70" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expedições (collapsible) */}
        {visibleExpedicaoItems.length > 0 && (
          <div>
            <button
              className={`${navItemCls} ${isExpedicaoItemActive ? navItemActiveCls : ""}`}
              onClick={() => setExpedicoesOpen(!expedicoesOpen)}
              data-figma="SidebarGroup"
              data-figma-label="Expedições"
              data-figma-variant={isExpedicaoItemActive ? "ativo" : "inativo"}
              data-figma-expanded={expedicoesOpen ? "true" : "false"}
            >
              <img src="/icons/cadastros/carro.svg" alt="" className="w-6 h-6 shrink-0" />
              <span>Expedições</span>
              <img
                src={expedicoesOpen ? "/icons/arrows/seta-aberta.svg" : "/icons/arrows/seta-fechada.svg"}
                alt=""
                className="w-3 h-3 shrink-0 ml-auto transition-transform duration-200 opacity-60"
                style={{ transform: expedicoesOpen ? "rotate(0)" : "rotate(-90deg)" }}
              />
            </button>

            {expedicoesOpen && (
              <div className={subItemsCls}>
                {visibleExpedicaoItems.map((item) => (
                  <button
                    key={item.path}
                    className={`${subItemCls} ${isActive(item.path) ? subItemActiveCls : ""}`}
                    onClick={() => navigate(item.path)}
                    data-figma="SidebarSubItem"
                    data-figma-label={item.label}
                    data-figma-variant={isActive(item.path) ? "ativo" : "inativo"}
                  >
                    <img src={item.icon} alt="" className="w-5 h-5 shrink-0 opacity-70" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
