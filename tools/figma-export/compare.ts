/**
 * Verificação 1:1 — compara a captura do navegador (gabarito) com o PNG que o
 * plugin do Figma reexporta a partir do frame reconstruído.
 *
 *   out/figma-export/screens/<slug>.png   (navegador, 2×)
 *   out/figma-export/verify/<slug>.png    (Figma, 2×, enviado pelo plugin)
 *   out/figma-export/diff/<slug>.png      (mapa das diferenças)
 *
 * Uso: npm run figma:compare
 *      (durante a colheita o plugin só envia arquivos se "conferir 1:1" estiver marcado)
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { OUT_DIR, ROOT } from "./config";

const LIMITE_CANAL = 12; // diferença por canal que já conta como divergência
const LIMITE_OK = 0.5; // % de pixels divergentes aceito como "1:1"

interface Comparacao {
  slug: string;
  largura: number;
  altura: number;
  diferentes: number;
  total: number;
  percentual: number;
  ok: boolean;
}

async function carregar(caminho: string, largura: number, altura: number) {
  return sharp(caminho)
    .resize(largura, altura, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function comparar(slug: string): Promise<Comparacao | null> {
  const referencia = path.join(OUT_DIR, "screens", `${slug}.png`);
  const reexportado = path.join(OUT_DIR, "verify", `${slug}.png`);
  if (!existsSync(referencia)) {
    console.log(`  ? ${slug}: sem captura de referência`);
    return null;
  }
  if (!existsSync(reexportado)) {
    console.log(`  ? ${slug}: sem PNG do Figma (marque "conferir 1:1" no plugin)`);
    return null;
  }

  const meta = await sharp(referencia).metadata();
  const largura = meta.width ?? 0;
  const altura = meta.height ?? 0;
  if (!largura || !altura) return null;

  const a = await carregar(referencia, largura, altura);
  const b = await carregar(reexportado, largura, altura);
  const diff = Buffer.alloc(largura * altura * 4);

  let diferentes = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    if (d > LIMITE_CANAL) {
      diferentes++;
      // vermelho = divergência, sobre o cinza da referência
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
      diff[i + 3] = 255;
    } else {
      const cinza = Math.round((a[i] + a[i + 1] + a[i + 2]) / 3);
      const suave = Math.round(cinza * 0.25 + 255 * 0.75);
      diff[i] = suave;
      diff[i + 1] = suave;
      diff[i + 2] = suave;
      diff[i + 3] = 255;
    }
  }

  const total = largura * altura;
  const percentual = (diferentes / total) * 100;
  mkdirSync(path.join(OUT_DIR, "diff"), { recursive: true });
  await sharp(diff, { raw: { width: largura, height: altura, channels: 4 } }).png().toFile(
    path.join(OUT_DIR, "diff", `${slug}.png`),
  );

  const resultado: Comparacao = {
    slug,
    largura,
    altura,
    diferentes,
    total,
    percentual,
    ok: percentual <= LIMITE_OK,
  };
  console.log(
    `  ${resultado.ok ? "✓" : "✗"} ${slug.padEnd(34)} ${percentual.toFixed(3)}% de pixels divergentes` +
      `  (diff: out/figma-export/diff/${slug}.png)`,
  );
  return resultado;
}

async function main() {
  const pastaVerify = path.join(OUT_DIR, "verify");
  if (!existsSync(pastaVerify)) {
    console.log("Nada para comparar: nenhum PNG do Figma em out/figma-export/verify/.");
    console.log('Abra o plugin no Figma, marque "conferir 1:1" e importe as telas.');
    return;
  }

  const slugs = readdirSync(pastaVerify)
    .filter((nome) => nome.endsWith(".png"))
    .map((nome) => nome.replace(/\.png$/, ""));

  if (!slugs.length) {
    console.log("Nenhum PNG do Figma encontrado em out/figma-export/verify/.");
    return;
  }

  console.log(`🔍 Comparando ${slugs.length} tela(s) com a captura do navegador\n`);
  const resultados: Comparacao[] = [];
  for (const slug of slugs) {
    const resultado = await comparar(slug);
    if (resultado) resultados.push(resultado);
  }

  if (!resultados.length) return;
  const medias = resultados.reduce((soma, r) => soma + r.percentual, 0) / resultados.length;
  const aprovadas = resultados.filter((r) => r.ok).length;
  console.log("");
  console.log(`média ${medias.toFixed(3)}% · ${aprovadas}/${resultados.length} dentro do limite de ${LIMITE_OK}%`);
  writeFileSync(
    path.join(OUT_DIR, "verify", "relatorio.json"),
    JSON.stringify({ limite: LIMITE_OK, medias, aprovadas, resultados }, null, 2),
    "utf8",
  );
  console.log(`relatório: ${path.relative(ROOT, path.join(OUT_DIR, "verify", "relatorio.json"))}`);
}

main().catch((erro) => {
  console.error("Falha na comparação:", erro);
  process.exit(1);
});
