"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import styles from "./dashboard.module.css";

export default function DashboardLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={styles.layout}>
      {sidebarOpen && <Sidebar />}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <img src="/icons/actions/hamburguer.svg" alt="hamburguer" />
          </button>
          {title && <h1 className={styles.title}>{title}</h1>}
        </header>

        {/* Content */}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}