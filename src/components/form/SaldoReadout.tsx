/** Quantidade de estoque como número (sempre em base, sem nome de unidade). */
function quantidade(valor: number): string {
  return String(valor);
}

interface SaldoReadoutProps {
  saldo: number;
  reservado: number;
}

/** Saldo e reservado do produto em modo leitura (faixa de identidade). */
export default function SaldoReadout({
  saldo,
  reservado,
}: SaldoReadoutProps) {
  return (
    <div className="flex items-center gap-4 text-right">
      <div className="flex flex-col">
        <span className="font-sans text-xs leading-4 text-[#697077]">Saldo</span>
        <span className="font-display text-base font-[590] tabular-nums text-ink-strong">
          {quantidade(saldo)}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-sans text-xs leading-4 text-[#697077]">
          Reservado
        </span>
        <span className="font-display text-base font-[590] tabular-nums text-ink-strong">
          {quantidade(reservado)}
        </span>
      </div>
    </div>
  );
}
