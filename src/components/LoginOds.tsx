/**
 * Selos dos ODS que decoram a tela de login.
 *
 * A faixa superior central (~0–25% da altura) fica reservada ao selo
 * institucional "INOVAÇÃO CIÊNCIA TECNOLOGIA", cujo arquivo ainda será
 * fornecido; nenhum ODS ocupa essa área.
 *
 * A camada é puramente decorativa: `aria-hidden` a esconde dos leitores de
 * tela, `pointer-events-none` não captura cliques e `z-0` a mantém atrás do
 * card do formulário (`z-10`).
 */
export default function LoginOds() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <img
        src="/ods/ods-8.svg"
        alt=""
        draggable={false}
        className="absolute left-[25.5%] top-[34%] h-auto w-[clamp(8.5rem,10.5vw,11.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
      <img
        src="/ods/ods-4.svg"
        alt=""
        draggable={false}
        className="absolute left-[74.5%] top-[34%] h-auto w-[clamp(8.5rem,10.5vw,11.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
      <img
        src="/ods/ods-12.svg"
        alt=""
        draggable={false}
        className="absolute left-[25.5%] top-[66.5%] h-auto w-[clamp(8.5rem,10.5vw,11.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
      <img
        src="/ods/ods-16.svg"
        alt=""
        draggable={false}
        className="absolute left-[74.5%] top-[66.5%] h-auto w-[clamp(8.5rem,10.5vw,11.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
      <img
        src="/ods/ods-9.svg"
        alt=""
        draggable={false}
        className="absolute left-1/2 top-[88%] h-auto w-[clamp(8.5rem,10.5vw,11.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
