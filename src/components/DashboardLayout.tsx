"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import Sidebar from "./Sidebar";
import UserMenu, { headerIconBtnCls, loadUser } from "./UserMenu";
import { sidebarRecolhidaStore, type SidebarUser } from "./sidebar-config";

export default function DashboardLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  // Estado do recolhido persistido: sobrevive à remontagem a cada navegação.
  const recolhida = useSyncExternalStore(
    sidebarRecolhidaStore.assinar,
    sidebarRecolhidaStore.snapshot,
    sidebarRecolhidaStore.servidor,
  );
  const [user, setUser] = useState<SidebarUser | null>(null);

  useEffect(() => {
    loadUser().then((u) => {
      if (u) setUser(u);
    });
  }, []);

  const alternarSidebar = () => sidebarRecolhidaStore.definir((v) => !v);
  const expandirSidebar = () => sidebarRecolhidaStore.definir(() => false);

  return (
    <div className="flex flex-col h-screen bg-white text-ink" data-figma="AppShell">
      <header
        className="flex items-center justify-between gap-2 w-full h-[var(--header-height)] min-h-10 px-4 bg-brand shrink-0 box-border"
        data-figma="AppBar"
        data-figma-title={title ?? ""}
        data-print-hide
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/dashboard" aria-label="Nexus" className="flex items-center shrink-0">
            <img src="/logo_horizontal.svg" alt="Nexus" className="h-10 w-auto" />
          </Link>
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 border-none bg-transparent text-white cursor-pointer rounded-md shrink-0 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.12)]"
            onClick={alternarSidebar}
            aria-label="Recolher menu"
          >
            <img src="/icons/actions/hamburguer.svg" alt="" aria-hidden="true" className="w-6 h-6" />
          </button>
          {title && (
            <h1 className="font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] text-white m-0 truncate min-w-0">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" className={headerIconBtnCls} aria-label="Configurações">
            <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className={headerIconBtnCls} aria-label="Notificações">
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <UserMenu user={user} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={recolhida} onExpand={expandirSidebar} user={user} />
        <main className="flex-1 min-w-0 flex flex-col gap-[0.625rem] py-4 px-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
