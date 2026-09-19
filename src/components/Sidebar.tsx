"use client";

import { useState } from "react";
import styles from "./Sidebar.module.css";

type MenuItem = {
  label: string;
  icon: string;
  href?: string;
  active?: boolean;
};

const cadastrosItems: MenuItem[] = [
  { label: "Usuários", icon: "👤" },
  { label: "Funcionários", icon: "🏢" },
  { label: "Destinatários", icon: "🏫" },
  { label: "Produtos", icon: "📦" },
  { label: "Fornecedores", icon: "🚚" },
  { label: "Condutores", icon: "🧑‍🔧" },
  { label: "Veículos", icon: "🚛" },
];

const navItems: MenuItem[] = [
  { label: "Mov. Estoque", icon: "📦", active: true },
  { label: "Pedidos", icon: "📋" },
  { label: "Relatórios", icon: "📊" },
];

export default function Sidebar() {
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [activeItem, setActiveItem] = useState("Mov. Estoque");

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoText}>NEXUS</div>
        <div className={styles.logoSub}>SISTEMA LOGÍSTICO</div>
      </div>

      <div className={styles.divider} />

      <nav className={styles.nav}>
        {/* Cadastros */}
        <button
          className={styles.sectionBtn}
          onClick={() => setCadastrosOpen(!cadastrosOpen)}
        >
          <span className={styles.arrow}>{cadastrosOpen ? "▼" : "▶"}</span>
          CADASTROS
        </button>

        {cadastrosOpen && (
          <div className={styles.subItems}>
            {cadastrosItems.map((item) => (
              <button
                key={item.label}
                className={styles.subItem}
                onClick={() => setActiveItem(item.label)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.divider} />

        {navItems.map((item) => (
          <button
            key={item.label}
            className={`${styles.navItem} ${activeItem === item.label ? styles.active : ""}`}
            onClick={() => setActiveItem(item.label)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.divider} />

      <div className={styles.profile}>
        <div className={styles.avatar}>J</div>
        <div>
          <div className={styles.profileName}>Jonathan</div>
          <div className={styles.profileRole}>Operador do Galpão</div>
        </div>
      </div>
    </aside>
  );
}