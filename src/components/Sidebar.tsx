"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserInfo } from "@/app/actions/user";
import { logoutAction } from "@/app/login/actions";
import styles from "./Sidebar.module.css";

// Cache o módulo para evitar recarregar a cada navegação
let cachedUser: { id_usuario: number; nome: string; login: string; super_admin: boolean } | null = null;
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
  { label: "Usuários", path: "/usuarios", icon: "/icons/cadastros/usuario.svg" },
  { label: "Funcionários", path: "/funcionarios", icon: "/icons/cadastros/funcionarios.svg" },
  { label: "Destinatários", path: "/destinatarios", icon: "/icons/cadastros/escola.svg" },
  { label: "Produtos", path: "/produtos", icon: "/icons/cadastros/produto.svg" },
  { label: "Fornecedores", path: "/fornecedores", icon: "/icons/nav/dados.svg" },
  { label: "Veículos", path: "/veiculos", icon: "/icons/cadastros/carro.svg" },
];

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "/icons/nav/dashboard.svg" },
  { label: "Mov. Estoque", path: "/mov-estoque", icon: "/icons/nav/estoque.svg" },
  { label: "Pedidos", path: "/pedidos", icon: "/icons/nav/dados.svg" },
  { label: "Relatórios", path: "/relatorios", icon: "/icons/nav/estoque.svg" },
];

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

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <img src="/logo.svg" alt="Nexus" className={styles.logo} />
      </div>

      {/* Botões de ação */}
      <div className={styles.buttonGroup}>
        <button className={styles.iconBtn}>
          <img src="/icons/actions/config.svg" alt="Configurações" />
        </button>
        <button className={styles.iconBtn}>
          <img src="/icons/actions/sino.svg" alt="Notificações" />
        </button>
      </div>

      {/* Menu */}
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ""}`}
            onClick={() => navigate(item.path)}
          >
            <img src={item.icon} alt="" className={styles.icon} />
            <span>{item.label}</span>
          </button>
        ))}

        {/* Cadastros (collapsible) */}
        <div>
          <button
            className={`${styles.navItem} ${isCadastroItemActive ? styles.active : ""}`}
            onClick={() => setCadastrosOpen(!cadastrosOpen)}
          >
            <img src="/icons/nav/cadastros.svg" alt="" className={styles.icon} />
            <span>Cadastros</span>
            <img
              src={cadastrosOpen ? "/icons/arrows/seta-aberta.svg" : "/icons/arrows/seta-fechada.svg"}
              alt=""
              className={styles.arrow}
              style={{ transform: cadastrosOpen ? "rotate(0)" : "rotate(-90deg)" }}
            />
          </button>

          {cadastrosOpen && (
            <div className={styles.subItems}>
              {cadastroItems.map((item) => (
                <button
                  key={item.path}
                  className={`${styles.subItem} ${isActive(item.path) ? styles.activeSub : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <img src={item.icon} alt="" className={styles.subIcon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Informações do Usuário */}
      <div className={styles.userSection} ref={menuRef}>
        <button
          className={styles.userInfo}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className={styles.userAvatar}>{initial}</div>
          <span className={styles.userName}>{user?.nome ?? "Carregando..."}</span>
        </button>

        {userMenuOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownName}>{user?.nome}</span>
              <span className={styles.dropdownLogin}>{user?.login}</span>
              {user?.super_admin && <span className={styles.badge}>Admin</span>}
            </div>
            <hr className={styles.divider} />
            <button className={styles.dropdownItem} onClick={handleLogout}>
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