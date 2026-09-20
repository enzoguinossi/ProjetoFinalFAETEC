"use client";

import DashboardLayout from "@/components/DashboardLayout";
import "@/app/home.css";

export default function DashboardPage() {
  return (
    <DashboardLayout title="Dashboard">
      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">ESTOQUE ATUAL</div>
          <div className="stat-value">1.247</div>
          <div className="stat-up">▲ 23 itens esta semana</div>
        </div>
        <div className="card">
          <div className="stat-label">PEDIDOS PENDENTES</div>
          <div className="stat-value">12</div>
          <div className="stat-warn">● 3 remessas aguardando</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">📢 Mural de Mensagens</h3>
        <div className="mural-item">
          <span>⏰ Validade próxima: 5 caixas de leite vencem em 15 dias</span>
          <span className="tag-auto">Automático</span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">⚠️ Pendências</h3>
        <div className="pendencia-row">
          <span>Remessa #1024 — ESCOLA MUNICIPAL CRUZEIRO</span>
          <span className="tag-pendente">Pendente</span>
        </div>
        <div className="pendencia-row">
          <span>Remessa #1021 — CRECHE BEM-QUERER</span>
          <span className="tag-pendente">Pendente</span>
        </div>
        <div className="pendencia-row">
          <span>📊 Inventário mensal — Dezembro</span>
          <span className="tag-contagem">Em contagem</span>
        </div>
      </div>
    </DashboardLayout>
  );
}