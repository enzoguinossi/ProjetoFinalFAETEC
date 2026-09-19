import DashboardLayout from "@/components/DashboardLayout";
import "./home.css";

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="home-header">
        <div>
          <h1 className="home-title">Dashboard</h1>
          <p className="home-subtitle">Bem-vindo, Jonathan</p>
        </div>
        <div className="home-actions">
          <button className="btn-outline">📅 Hoje</button>
          <button className="btn-icon">🔔</button>
        </div>
      </div>

      {/* Mural */}
      <div className="card">
        <h3 className="card-title">📢 Mural de Mensagens</h3>
        <div className="mural-item">
          <span>⏰ Validade próxima: 5 caixas de leite vencem em 15 dias</span>
          <span className="tag-auto">Automático</span>
        </div>
      </div>

      {/* Stats */}
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

      {/* Pendências */}
      <div className="card">
        <h3 className="card-title">⚠️ Pendências</h3>
        <div className="pendencia-row">
          <span>🧑‍🔧 Remessa #1024 — ESCOLA MUNICIPAL CRUZEIRO</span>
          <span className="tag-pendente">Pendente</span>
        </div>
        <div className="pendencia-row">
          <span>🧑‍🔧 Remessa #1021 — CRECHE BEM-QUERER</span>
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