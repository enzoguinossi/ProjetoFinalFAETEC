"use client";

import { useState } from "react";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [activeItem, setActiveItem] = useState("Dashboard");

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <img src="/logo.svg" alt="Nexus" className={styles.logo} />
      </div>

      {/* Botões de ação */}
      <div className={styles.buttonGroup}>
        <button className={styles.iconBtn}>
          <img src="/icons/actions/config.svg" alt="Config" />
        </button>
        <button className={styles.iconBtn}>
          <img src="/icons/actions/sino.svg" alt="Notificações" />
        </button>
      </div>

      {/* Menu de navegação */}
      <nav className={styles.nav}>
        {/* Dashboard */}
        <button
          className={`${styles.navItem} ${activeItem === "Dashboard" ? styles.active : ""}`}
          onClick={() => setActiveItem("Dashboard")}
        >
          <img src="/icons/nav/dashboard.svg" alt="" className={styles.icon} />
          <span>Dashboard</span>
        </button>

        {/* Cadastros (collapsible) */}
        <div>
          <button
            className={styles.navItem}
            onClick={() => setCadastrosOpen(!cadastrosOpen)}
          >
            <img src="/icons/nav/cadastros.svg" alt="" className={styles.icon} />
            <span>Cadastros</span>
            <img
              src={cadastrosOpen ? "/icons/arrows/seta-aberta.svg" : "/icons/arrows/seta-fechada.svg"}
              alt=""
              className={styles.arrow}
            />
          </button>

          {cadastrosOpen && (
            <div className={styles.subItems}>
              {[
                { label: "Usuários", icon: "/icons/cadastros/usuario.svg" },
                { label: "Funcionários", icon: "/icons/cadastros/funcionarios.svg" },
                { label: "Destinatários", icon: "/icons/cadastros/escola.svg" },
                { label: "Produtos", icon: "/icons/cadastros/produto.svg" },
                { label: "Fornecedores", icon: "/icons/nav/dados.svg" },
                { label: "Condutores", icon: "/icons/cadastros/funcionarios.svg" },
                { label: "Veículos", icon: "/icons/cadastros/carro.svg" },
              ].map((item) => (
                <button
                  key={item.label}
                  className={`${styles.subItem} ${activeItem === item.label ? styles.activeSub : ""}`}
                  onClick={() => setActiveItem(item.label)}
                >
                  <img src={item.icon} alt="" className={styles.subIcon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mov. Estoque */}
        <button
          className={`${styles.navItem} ${activeItem === "Mov. Estoque" ? styles.active : ""}`}
          onClick={() => setActiveItem("Mov. Estoque")}
        >
          <img src="/icons/nav/estoque.svg" alt="" className={styles.icon} />
          <span>Mov. Estoque</span>
        </button>

        {/* Pedidos */}
        <button
          className={`${styles.navItem} ${activeItem === "Pedidos" ? styles.active : ""}`}
          onClick={() => setActiveItem("Pedidos")}
        >
          <img src="/icons/nav/dados.svg" alt="" className={styles.icon} />
          <span>Pedidos</span>
        </button>

        {/* Relatórios */}
        <button
          className={`${styles.navItem} ${activeItem === "Relatórios" ? styles.active : ""}`}
          onClick={() => setActiveItem("Relatórios")}
        >
          <img src="/icons/nav/estoque.svg" alt="" className={styles.icon} />
          <span>Relatórios</span>
        </button>
      </nav>

      {/* Informações do Usuário */}
      <div className={styles.userInfo}>
        <div className={styles.userAvatar}>J</div>
        <span className={styles.userName}>Jonathan</span>
      </div>
    </aside>
  );
}