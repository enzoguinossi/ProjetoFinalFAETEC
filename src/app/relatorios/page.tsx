import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

type CartaoRelatorio = {
  titulo: string;
  descricao: string;
  href?: string;
};

const relatorios: CartaoRelatorio[] = [
  {
    titulo: "Lista de Produtos",
    descricao:
      "Código, descrição, unidade, quantidade e saldo livre de cada produto, com filtro por situação.",
    href: "/relatorios/produtos",
  },
  {
    titulo: "Movimentação de Estoque",
    descricao:
      "Entradas, saídas e ajustes do estoque, com filtros por período, produto e tipo.",
    href: "/relatorios/movimentacao",
  },
  {
    titulo: "Extrato de Produto",
    descricao:
      "Movimentações de estoque de um produto em um período. Abra a tela e escolha o produto no filtro.",
    href: "/relatorios/movimentacao",
  },
  {
    titulo: "Expedições por Período",
    descricao:
      "Expedições com data prevista no período, com veículo, condutor, notas, destinatários e itens.",
    href: "/relatorios/expedicoes",
  },
  {
    titulo: "Entregas por Instituição",
    descricao:
      "Notas de saída por destinatário no período, com itens esperados, entregues e pendentes.",
    href: "/relatorios/entregas",
  },
  {
    titulo: "Funcionários",
    descricao:
      "Funcionários cadastrados, com código, CPF, cargo, condutor, situação e contato principal.",
    href: "/relatorios/funcionarios",
  },
  {
    titulo: "Destinatários",
    descricao:
      "Escolas e creches atendidas, com CNPJ, tipo, situação, endereço e contato principal.",
    href: "/relatorios/destinatarios",
  },
  {
    titulo: "Fornecedores",
    descricao:
      "Fornecedores cadastrados, com CNPJ, situação, endereço e contato principal.",
    href: "/relatorios/fornecedores",
  },
  {
    titulo: "Produtos Próximos ao Vencimento",
    descricao:
      "Produtos perecíveis com validade, dias restantes e situação, com filtro de dias para vencer.",
    href: "/relatorios/vencimento",
  },
  {
    titulo: "Auditoria",
    descricao:
      "Trilha de auditoria do sistema, com usuário, período, entidade e ação.",
  },
];

export default async function RelatoriosPage() {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink m-0">Relatórios</h2>
        <p className="text-sm text-[#697077] m-0">
          Documentos gerados a partir dos dados do sistema, prontos para impressão,
          PDF e CSV.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
        {relatorios.map((relatorio) =>
          relatorio.href ? (
            <Link
              key={relatorio.titulo}
              href={relatorio.href}
              className="flex flex-col gap-2 bg-white rounded-xl border border-border p-5 text-ink no-underline transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            >
              <span className="text-base font-semibold">{relatorio.titulo}</span>
              <span className="text-sm text-[#697077]">{relatorio.descricao}</span>
              <span className="text-sm font-semibold text-brand mt-auto">
                Abrir relatório →
              </span>
            </Link>
          ) : (
            <div
              key={relatorio.titulo}
              className="flex flex-col gap-2 bg-[#f2f4f8] rounded-xl border border-border p-5 text-ink"
              aria-disabled
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{relatorio.titulo}</span>
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[#697077] bg-white border border-border rounded-full px-2 py-0.5">
                  Em breve
                </span>
              </div>
              <span className="text-sm text-[#697077]">{relatorio.descricao}</span>
            </div>
          ),
        )}
      </div>
    </DashboardLayout>
  );
}
