"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getUserInfo } from "@/app/actions/user";
import { logoutAction } from "@/app/login/actions";
import type { SidebarUser } from "@/components/sidebar-config";

// Cache o módulo para carregar o usuário uma única vez por sessão do cliente.
let cachedUser: SidebarUser | null = null;
let cachePromise: Promise<SidebarUser | null> | null = null;

export function loadUser(): Promise<SidebarUser | null> {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (cachePromise) return cachePromise;
  cachePromise = (getUserInfo() as Promise<SidebarUser | null>).then((u) => {
    cachedUser = u;
    cachePromise = null;
    return u;
  });
  return cachePromise;
}

export function resetUserCache() {
  cachedUser = null;
  cachePromise = null;
}

export const headerIconBtnCls =
  "w-9 h-9 flex items-center justify-center border-none bg-transparent text-white cursor-pointer rounded-md shrink-0 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.12)]";

interface UserMenuProps {
  user: SidebarUser | null;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    resetUserCache();
    await logoutAction();
    router.push("/login");
  }

  const initial = user?.nome?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        className={`${headerIconBtnCls} rounded-full`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.nome ?? "Usuário"}
      >
        <span className="w-8 h-8 rounded-full bg-[#f2f4f8] flex items-center justify-center font-sans text-sm font-semibold text-[#001d6c]">
          {initial}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#dde1e6] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] overflow-hidden z-[100]"
        >
          <div className="flex flex-col gap-[2px] p-3">
            <span className="font-sans text-[0.8125rem] font-semibold text-ink">
              {user?.nome ?? "Carregando..."}
            </span>
            <span className="font-sans text-xs text-[#697077]">{user?.login}</span>
            {user?.super_admin && (
              <span className="font-sans text-[0.6875rem] font-semibold text-brand bg-[rgba(27,153,86,0.08)] px-[6px] py-[2px] rounded-[4px] self-start mt-1">
                Admin
              </span>
            )}
          </div>
          <hr className="border-t border-[#e2e2e2] m-0" />
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-2 w-full px-3 py-[0.625rem] border-none bg-transparent cursor-pointer font-sans text-[0.8125rem] text-danger text-left transition-[background-color] duration-[120ms] hover:bg-danger-bg"
            onClick={handleLogout}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
