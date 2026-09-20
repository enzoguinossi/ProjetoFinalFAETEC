"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const cadastroItems = [
  { label: "Usuários", path: "/usuarios", icon: "/icons/cadastros/usuario.svg" },
  { label: "Funcionários", path: "/funcionarios", icon: "/icons/cadastros/funcionarios.svg" },
  { label: "Destinatários", path: "/destinatarios", icon: "/icons/cadastros/escola.svg" },
  { label: "Produtos", path: "/produtos", icon: "/icons/cadastros/produto.svg" },
  { label: "Fornecedores", path: "/fornecedores", icon: "/icons/nav/dados.svg" },
  { label: "Condutores", path: "/condutores", icon: "/icons/cadastros/funcionarios.svg" },
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
  const router = useRouter();
  const pathname = usePathname();

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
      <div className={styles.userInfo}>
        <div className={styles.userAvatar}>J</div>
        <span className={styles.userName}>Jonathan</span>
      </div>
    </aside>
  );
}