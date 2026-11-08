/**
 * Badge de situação (Ativo/Inativo) das listagens de cadastro.
 * Mesmo padrão visual usado em Produtos.
 */
export default function SituacaoBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs leading-4 ${
        ativo
          ? "bg-[rgba(27,153,86,0.12)] text-[#15844a]"
          : "bg-[#eef1f4] text-[#697077]"
      }`}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
