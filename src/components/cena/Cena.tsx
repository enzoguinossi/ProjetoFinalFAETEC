import cenaJson from "./cena.json";

type Camada = {
  id: string;
  arquivo: string;
  tipo: string;
  fundo?: boolean;
  x?: number;
  y?: number;
  largura?: number;
  escala?: number;
  ancora?: "ponta";
};

type CenaManifesto = {
  palco: { largura: number; altura: number };
  camadas: Camada[];
};

const manifesto = cenaJson as CenaManifesto;

/**
 * Cena decorativa do login.
 *
 * Cada camada do manifesto é uma `<img>` posicionada sobre um palco 16:9 que
 * cobre a viewport (o excedente é cortado pelo container, como um
 * `background-size: cover`). A ordem do array é a ordem de empilhamento.
 */
export default function Cena() {
  const { largura: palcoLargura, altura: palcoAltura } = manifesto.palco;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-cena="palco"
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: "max(100%, 177.7778vh)", aspectRatio: "16 / 9" }}
      >
        {manifesto.camadas.map((c) => {
          if (c.fundo) {
            return (
              <img
                key={c.id}
                src={`/brand/cena/${c.arquivo}`}
                alt=""
                draggable={false}
                data-cena-id={c.id}
                data-cena-tipo={c.tipo}
                className="absolute select-none"
                style={{ inset: 0, width: "100%", height: "100%" }}
              />
            );
          }

          const { x = 0, y = 0, largura = 0, escala = 1 } = c;

          return (
            <img
              key={c.id}
              src={`/brand/cena/${c.arquivo}`}
              alt=""
              draggable={false}
              data-cena-id={c.id}
              data-cena-tipo={c.tipo}
              className="absolute select-none"
              style={{
                left: `${(x / palcoLargura) * 100}%`,
                top: `${(y / palcoAltura) * 100}%`,
                width: `${((largura * escala) / palcoLargura) * 100}%`,
                height: "auto",
                ...(c.ancora === "ponta"
                  ? { transform: "translate(-50%, -90.476%)" }
                  : {}),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
