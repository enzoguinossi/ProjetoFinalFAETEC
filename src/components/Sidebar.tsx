"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Settings } from "lucide-react";
import { getUserInfo } from "@/app/actions/user";
import { logoutAction } from "@/app/login/actions";
import {
  cadastroItems,
  cadastrosGroup,
  expedicaoItems,
  expedicoesGroup,
  movEstoqueGroup,
  movEstoqueItems,
  navBottomItems,
  navTopItems,
  sidebarCls,
  headerCls,
  logoAreaCls,
  buttonGroupCls,
  iconBtnCls,
  navCls,
  navItemCls,
  navItemActiveCls,
  navItemIconCls,
  navItemIconInactiveCls,
  navChevronCls,
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

const MovEstoqueIcon = movEstoqueGroup.icon;
const ExpedicoesIcon = expedicoesGroup.icon;
const CadastrosIcon = cadastrosGroup.icon;

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
      {/* Cabeçalho fixo: logo + ações */}
      <div className={headerCls}>
        <div className={logoAreaCls}>
          <img src="/logo.svg" alt="Nexus" className="h-10 w-auto" />
        </div>

        <div className={buttonGroupCls}>
          <button type="button" className={iconBtnCls} aria-label="Configurações">
            <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className={iconBtnCls} aria-label="Notificações">
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Menu rolável — o bloco do usuário nunca é coberto */}
      <nav className={navCls} aria-label="Menu principal">
        {navTopItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              className={`${navItemCls} ${active ? navItemActiveCls : ""}`}
              onClick={() => navigate(item.path)}
              data-figma="SidebarItem"
              data-figma-label={item.label}
              data-figma-variant={active ? "ativo" : "inativo"}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className={`${navItemIconCls} ${active ? "" : navItemIconInactiveCls}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Mov. Estoque (collapsible) */}
        {visibleMovEstoqueItems.length > 0 && (
          <div>
            <button
              className={`${navItemCls} ${isMovEstoqueItemActive ? navItemActiveCls : ""}`}
              onClick={() => setMovEstoqueOpen(!movEstoqueOpen)}
              data-figma="SidebarGroup"
              data-figma-label={movEstoqueGroup.label}
              data-figma-variant={isMovEstoqueItemActive ? "ativo" : "inativo"}
              data-figma-expanded={movEstoqueOpen ? "true" : "false"}
            >
              <MovEstoqueIcon
                size={18}
                strokeWidth={1.75}
                className={`${navItemIconCls} ${isMovEstoqueItemActive ? "" : navItemIconInactiveCls}`}
                aria-hidden="true"
              />
              <span>{movEstoqueGroup.label}</span>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className={navChevronCls}
                style={{ transform: movEstoqueOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                aria-hidden="true"
              />
            </button>

            {movEstoqueOpen && (
              <div className={subItemsCls}>
                {visibleMovEstoqueItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      className={`${subItemCls} ${active ? subItemActiveCls : ""}`}
                      onClick={() => navigate(item.path)}
                      data-figma="SidebarSubItem"
                      data-figma-label={item.label}
                      data-figma-variant={active ? "ativo" : "inativo"}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className={`${navItemIconCls} ${active ? "" : navItemIconInactiveCls}`}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Expedições (collapsible) */}
        {visibleExpedicaoItems.length > 0 && (
          <div>
            <button
              className={`${navItemCls} ${isExpedicaoItemActive ? navItemActiveCls : ""}`}
              onClick={() => setExpedicoesOpen(!expedicoesOpen)}
              data-figma="SidebarGroup"
              data-figma-label={expedicoesGroup.label}
              data-figma-variant={isExpedicaoItemActive ? "ativo" : "inativo"}
              data-figma-expanded={expedicoesOpen ? "true" : "false"}
            >
              <ExpedicoesIcon
                size={18}
                strokeWidth={1.75}
                className={`${navItemIconCls} ${isExpedicaoItemActive ? "" : navItemIconInactiveCls}`}
                aria-hidden="true"
              />
              <span>{expedicoesGroup.label}</span>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className={navChevronCls}
                style={{ transform: expedicoesOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                aria-hidden="true"
              />
            </button>

            {expedicoesOpen && (
              <div className={subItemsCls}>
                {visibleExpedicaoItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      className={`${subItemCls} ${active ? subItemActiveCls : ""}`}
                      onClick={() => navigate(item.path)}
                      data-figma="SidebarSubItem"
                      data-figma-label={item.label}
                      data-figma-variant={active ? "ativo" : "inativo"}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className={`${navItemIconCls} ${active ? "" : navItemIconInactiveCls}`}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Cadastros (collapsible) */}
        {visibleCadastroItems.length > 0 && (
          <div>
            <button
              className={`${navItemCls} ${isCadastroItemActive ? navItemActiveCls : ""}`}
              onClick={() => setCadastrosOpen(!cadastrosOpen)}
              data-figma="SidebarGroup"
              data-figma-label={cadastrosGroup.label}
              data-figma-variant={isCadastroItemActive ? "ativo" : "inativo"}
              data-figma-expanded={cadastrosOpen ? "true" : "false"}
            >
              <CadastrosIcon
                size={18}
                strokeWidth={1.75}
                className={`${navItemIconCls} ${isCadastroItemActive ? "" : navItemIconInactiveCls}`}
                aria-hidden="true"
              />
              <span>{cadastrosGroup.label}</span>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className={navChevronCls}
                style={{ transform: cadastrosOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                aria-hidden="true"
              />
            </button>

            {cadastrosOpen && (
              <div className={subItemsCls}>
                {visibleCadastroItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      className={`${subItemCls} ${active ? subItemActiveCls : ""}`}
                      onClick={() => navigate(item.path)}
                      data-figma="SidebarSubItem"
                      data-figma-label={item.label}
                      data-figma-variant={active ? "ativo" : "inativo"}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className={`${navItemIconCls} ${active ? "" : navItemIconInactiveCls}`}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {navBottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              className={`${navItemCls} ${active ? navItemActiveCls : ""}`}
              onClick={() => navigate(item.path)}
              data-figma="SidebarItem"
              data-figma-label={item.label}
              data-figma-variant={active ? "ativo" : "inativo"}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className={`${navItemIconCls} ${active ? "" : navItemIconInactiveCls}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Rodapé fixo: informações do usuário */}
      <div className="relative w-full shrink-0" ref={menuRef}>
        <button
          className={userInfoCls}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className="w-10 h-10 rounded-full bg-[#f2f4f8] flex items-center justify-center font-sans text-sm font-semibold text-[#001d6c] shrink-0">
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
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
