/**
 * Selo institucional "INOVAÇÃO CIÊNCIA TECNOLOGIA" da tela de login.
 *
 * A faixa superior central (~0–25% da altura) já era reservada a este selo em
 * `LoginOds`; aqui ele ocupa o topo, centralizado, sem sobrepor o card do
 * formulário. A arte original é cinza e transparente — o filtro a deixa branca
 * para contrastar com o verde institucional do fundo.
 *
 * A camada é decorativa: `pointer-events-none` não captura cliques e `z-0` a
 * mantém atrás do card (`z-10`).
 */
export default function LoginBrand() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[2.5%] z-0 w-[clamp(9rem,12vw,13rem)] -translate-x-1/2 select-none">
      <img
        src="/brand/logo-inovacao.svg"
        alt="Inovação, Ciência e Tecnologia"
        draggable={false}
        className="h-auto w-full [filter:brightness(0)_invert(1)]"
      />
    </div>
  );
}
