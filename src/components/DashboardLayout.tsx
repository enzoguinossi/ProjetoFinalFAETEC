"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import Sidebar from "./Sidebar";
import UserMenu, { headerIconBtnCls, loadUser } from "./UserMenu";
import { sidebarRecolhidaStore, type SidebarUser } from "./sidebar-config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
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
    <div
      className="flex flex-col h-screen bg-white text-ink overflow-hidden"
      data-figma="AppShell"
    >
      {/* Faixa superior — logo em largura fixa (nunca encolhe) + header. */}
      <div className="flex shrink-0 h-[var(--header-height)]" data-print-hide>
        <div className="flex items-center justify-center w-[var(--sidebar-width)] shrink-0 bg-brand px-2 box-border overflow-hidden">
          <Link href="/dashboard" aria-label="Nexus" className="flex items-center justify-center w-full">
            <img
              src="/logo_horizontal.svg"
              alt="Nexus"
              className="w-full h-auto"
              style={{
                filter:
                  "drop-shadow(0 0 2px rgba(255,255,255,0.65)) drop-shadow(0 0 5px rgba(255,255,255,0.35))",
              }}
            />
          </Link>
        </div>

        {/* Header alinhado ao conteúdo. */}
        <header
          className="flex flex-1 items-center justify-between gap-2 min-w-0 px-5 bg-brand box-border"
          data-figma="AppBar"
          data-print-hide
        >
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button type="button" className={headerIconBtnCls} aria-label="Configurações">
              <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className={headerIconBtnCls} aria-label="Notificações">
              <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <UserMenu user={user} />
          </div>
        </header>
      </div>

      {/* Conteúdo — sidebar (a largura vem da coluna do grid) + main. */}
      <div
        className="grid flex-1 min-h-0 transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          gridTemplateColumns: recolhida
            ? "72px minmax(0,1fr)"
            : "var(--sidebar-width) minmax(0,1fr)",
        }}
      >
        <Sidebar collapsed={recolhida} onToggle={alternarSidebar} onExpand={expandirSidebar} user={user} />

        <main className="min-w-0 min-h-0 flex flex-col gap-[0.625rem] py-4 px-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
