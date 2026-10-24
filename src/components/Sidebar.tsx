"use client";

import { useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  sidebarGruposStore,
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
  type GrupoSidebar,
  type SidebarUser,
} from "@/components/sidebar-config";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onExpand?: () => void;
  user: SidebarUser | null;
}

const MovEstoqueIcon = movEstoqueGroup.icon;
const ExpedicoesIcon = expedicoesGroup.icon;
const CadastrosIcon = cadastrosGroup.icon;

export default function Sidebar({ collapsed, onToggle, onExpand, user }: SidebarProps) {
  // Grupos persistidos: sobrevivem à remontagem a cada navegação.
  const grupos = useSyncExternalStore(
    sidebarGruposStore.assinar,
    sidebarGruposStore.snapshot,
    sidebarGruposStore.servidor,
  );
  const router = useRouter();
  const pathname = usePathname();

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

  // Atualizações funcionais: cliques rápidos nunca dependem do estado do closure.
  // No rail o grupo não abre in-place: expande a sidebar e já deixa o grupo aberto.
  const toggleGrupo = (id: GrupoSidebar) => {
    if (collapsed) {
      onExpand?.();
      sidebarGruposStore.definir((atual) => (atual[id] ? atual : { ...atual, [id]: true }));
      return;
    }
    sidebarGruposStore.definir((atual) => ({ ...atual, [id]: !atual[id] }));
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
      data-print-hide
    >
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} shrink-0 px-1 pb-2`}>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 shrink-0 border-none bg-transparent text-[#697077] cursor-pointer rounded-md transition-colors duration-150 hover:bg-[#f2f4f8] hover:text-ink"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>

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
              onClick={() => toggleGrupo("mov")}
              title={collapsed ? movEstoqueGroup.label : undefined}
              data-figma="SidebarGroup"
              data-figma-label={movEstoqueGroup.label}
              data-figma-variant={isMovEstoqueItemActive ? "ativo" : "inativo"}
              data-figma-expanded={grupos.mov ? "true" : "false"}
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
                  style={{ transform: grupos.mov ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && grupos.mov && (
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
              onClick={() => toggleGrupo("expedicoes")}
              title={collapsed ? expedicoesGroup.label : undefined}
              data-figma="SidebarGroup"
              data-figma-label={expedicoesGroup.label}
              data-figma-variant={isExpedicaoItemActive ? "ativo" : "inativo"}
              data-figma-expanded={grupos.expedicoes ? "true" : "false"}
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
                  style={{ transform: grupos.expedicoes ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && grupos.expedicoes && (
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
              onClick={() => toggleGrupo("cadastros")}
              title={collapsed ? cadastrosGroup.label : undefined}
              data-figma="SidebarGroup"
              data-figma-label={cadastrosGroup.label}
              data-figma-variant={isCadastroItemActive ? "ativo" : "inativo"}
              data-figma-expanded={grupos.cadastros ? "true" : "false"}
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
                  style={{ transform: grupos.cadastros ? "rotate(0deg)" : "rotate(-90deg)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {!collapsed && grupos.cadastros && (
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
    </aside>
  );
}
