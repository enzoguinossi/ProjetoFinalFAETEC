import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="text-[0.6875rem] text-[#8a8f9a] mb-1">ESTOQUE ATUAL</div>
          <div className="text-2xl font-bold">1.247</div>
          <div className="text-[0.6875rem] text-[#34a853] mt-1">▲ 23 itens esta semana</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="text-[0.6875rem] text-[#8a8f9a] mb-1">PEDIDOS PENDENTES</div>
          <div className="text-2xl font-bold">12</div>
          <div className="text-[0.6875rem] text-[#fbbc04] mt-1">● 3 saídas aguardando</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <h3 className="text-[0.8125rem] font-semibold mb-2">📢 Mural de Mensagens</h3>
        <div className="bg-[#f2f4f8] rounded-lg px-[0.875rem] py-[0.625rem] text-xs flex justify-between items-center">
          <span>⏰ Validade próxima: 5 caixas de leite vencem em 15 dias</span>
          <span className="text-[0.625rem] text-[#8a8f9a]">Automático</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <h3 className="text-[0.8125rem] font-semibold mb-2">⚠️ Pendências</h3>
        <div className="text-xs py-1.5 flex justify-between border-b border-border last:border-b-0">
          <span>Saída #1024 — ESCOLA MUNICIPAL CRUZEIRO</span>
          <span className="text-[#fbbc04] text-[0.6875rem]">Pendente</span>
        </div>
        <div className="text-xs py-1.5 flex justify-between border-b border-border last:border-b-0">
          <span>Saída #1021 — CRECHE BEM-QUERER</span>
          <span className="text-[#fbbc04] text-[0.6875rem]">Pendente</span>
        </div>
        <div className="text-xs py-1.5 flex justify-between border-b border-border last:border-b-0">
          <span>📊 Inventário mensal — Dezembro</span>
          <span className="text-brand text-[0.6875rem]">Em contagem</span>
        </div>
      </div>
    </>
  );
}
