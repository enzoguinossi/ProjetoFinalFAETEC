"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-white text-ink">
      {sidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-[0.625rem] h-[var(--header-height)] min-h-10 px-[0.1875rem] bg-brand box-border">
          <button
            className="flex items-center justify-center w-9 h-9 border-none bg-transparent text-white cursor-pointer rounded-md shrink-0 transition-[background-color] duration-[120ms] hover:bg-[rgba(255,255,255,0.12)] [&_svg]:w-6 [&_svg]:h-6"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <img src="/icons/actions/hamburguer.svg" alt="hamburguer" />
          </button>
          {title && (
            <h1 className="font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] text-white m-0">
              {title}
            </h1>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col gap-[0.625rem] py-4 px-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
