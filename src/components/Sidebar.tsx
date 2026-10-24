"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  sidebarCollapsedCls,
  sidebarExpandedCls,
  headerCls,
  logoAreaCls,
  buttonGroupCls,
  buttonGroupCollapsedCls,
  iconBtnCls,
  navCls,
  navItemCls,
  navItemExpandedCls,
  navItemCollapsedCls,
  navItemActiveCls,
  navItemIconCls,
  navItemIconInactiveCls,
  navChevronCls,
  subItemsCls,
  subItemCls,
  subItemActiveCls,
  userInfoCls,
  userInfoCollapsedCls,
  userMenuCls,
  userMenuCollapsedCls,
  type SidebarUser,
} from "@/components/sidebar-config";

interface SidebarProps {
  collapsed: boolean;
  onExpand?: () => void;
}

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

export default function Sidebar({ collapsed, onExpand }: SidebarProps) {
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

  // No rail o grupo não abre: expande a sidebar e já deixa o grupo aberto.
  const toggleGroup = (open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) => {
    if (collapsed) {
      onExpand?.();
      setOpen(true);
      return;
    }
    setOpen(!open);
  };

  const itemCls = collapsed
    ? `${navItemCls} ${navItemCollapsedCls}`
    : `${navItemCls} ${navItemExpandedCls}`;
  const renderLabel = (text: string) => (collapsed ? null : <span>{text}</span>);

  return (
    <aside
      className={`${sidebarCls} ${collapsed ? sidebarCollapsedCls : sidebarExpandedCls}`}
      data-figma="Sidebar"
      data-figma-variant={visibleCadastroItems.length > 0 ? "com-cadastros" : "sem-cadastros"}
    >
      {/* Cabeçalho fixo: logo + ações */}
      <div className={headerCls}>
        {!collapsed && (
          <div className={logoAreaCls}>
            <img src="/logo.svg" alt="Nexus" className="h-10 w-auto" />
          </div>
        )}

        <div className={collapsed ? buttonGroupCollapsedCls : buttonGroupCls}>
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
              className={`${itemCls} ${active ? navItemActiveCls : ""}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
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
              {renderLabel(item.label)}
            </button>
          );
        })}

        {/* Mov. Estoque (collapsible) */}
        {visibleMovEstoqueItems.length > 0 && (
          <div>
            <button
              className={`${itemCls} ${isMovEstoqueItemActive ? navItemActiveCls : ""}`}
              onClick={() => toggleGroup(movEstoqueOpen, setMovEstoqueOpen)}
              title={collapsed ? movEstoqueGroup.label : undefined}
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
              {renderLabel(movEstoqueGroup.label)}
              {!collapsed && (
                <ChevronDown
                  size={16}
                  strokeWidth={1.75}
                  className={navChevronCls}
                  style={{ transform: movEstoqueOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && movEstoqueOpen && (
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
              className={`${itemCls} ${isExpedicaoItemActive ? navItemActiveCls : ""}`}
              onClick={() => toggleGroup(expedicoesOpen, setExpedicoesOpen)}
              title={collapsed ? expedicoesGroup.label : undefined}
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
              {renderLabel(expedicoesGroup.label)}
              {!collapsed && (
                <ChevronDown
                  size={16}
                  strokeWidth={1.75}
                  className={navChevronCls}
                  style={{ transform: expedicoesOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && expedicoesOpen && (
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
              className={`${itemCls} ${isCadastroItemActive ? navItemActiveCls : ""}`}
              onClick={() => toggleGroup(cadastrosOpen, setCadastrosOpen)}
              title={collapsed ? cadastrosGroup.label : undefined}
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
              {renderLabel(cadastrosGroup.label)}
              {!collapsed && (
                <ChevronDown
                  size={16}
                  strokeWidth={1.75}
                  className={navChevronCls}
                  style={{ transform: cadastrosOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && cadastrosOpen && (
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
              className={`${itemCls} ${active ? navItemActiveCls : ""}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
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
              {renderLabel(item.label)}
            </button>
          );
        })}
      </nav>

      {/* Rodapé fixo: informações do usuário (no rail, só o avatar) */}
      <div className="relative w-full shrink-0" ref={menuRef}>
        <button
          className={collapsed ? userInfoCollapsedCls : userInfoCls}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          title={collapsed ? user?.nome ?? "Usuário" : undefined}
          aria-label={collapsed ? "Menu do usuário" : undefined}
        >
          <div className="w-10 h-10 rounded-full bg-[#f2f4f8] flex items-center justify-center font-sans text-sm font-semibold text-[#001d6c] shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <span className="font-sans text-xs text-black">{user?.nome ?? "Carregando..."}</span>
          )}
        </button>

        {userMenuOpen && (
          <div className={collapsed ? userMenuCollapsedCls : userMenuCls}>
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
