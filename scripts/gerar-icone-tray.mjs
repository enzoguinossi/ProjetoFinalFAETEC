#!/usr/bin/env node
/**
 * Gera o ícone da bandeja (`NexusTray.ico`) a partir de `public/logo.svg`.
 *
 * O `NotifyIcon` da bandeja já usa o logo em runtime; o arquivo `.exe` precisa
 * do mesmo símbolo para que o atalho **Bandeja do Nexus** exiba o ícone do
 * Nexus (`<ApplicationIcon>` em `NexusTray.csproj`). O atalho continua
 * apontando para `wscript.exe` por causa da elevação sem UAC.
 *
 * Saída: `deploy/windows/NexusTray/NexusTray.ico`, com entradas PNG nos
 * tamanhos 16, 24, 32, 48, 64, 128 e 256 (ICONDIR + ICONDIRENTRY + dados).
 * O `.ico` é versionado para o build do instalador não depender de ordem.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG_FILE = path.join(ROOT, "public", "logo.svg");
const ICO_FILE = path.join(ROOT, "deploy", "windows", "NexusTray", "NexusTray.ico");

/** Tamanhos em pixels esperados pelo Windows (shell, Explorer e atalho). */
const SIZES = [16, 24, 32, 48, 64, 128, 256];
/** O SVG original é 72×80; rasteriza alto e reduz para cada tamanho. */
const SVG_HEIGHT = 80;
const RASTER_HEIGHT = 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  console.error(`\n[ERRO] ${message}`);
  process.exit(1);
}

function readSvg() {
  let svg;
  try {
    svg = fs.readFileSync(SVG_FILE);
  } catch (error) {
    fail(`Não foi possível ler ${SVG_FILE}: ${error.message}`);
  }
  if (!svg || svg.length === 0) {
    fail(`${SVG_FILE} está vazio; o ícone não pode ser gerado.`);
  }
  if (!/<svg[\s>]/i.test(svg.toString("utf8"))) {
    fail(`${SVG_FILE} não parece um SVG válido (raiz <svg> não encontrada).`);
  }
  return svg;
}

async function renderPngs(svg) {
  const density = Math.ceil((72 * RASTER_HEIGHT) / SVG_HEIGHT);
  let base;
  try {
    base = await sharp(svg, { density })
      .ensureAlpha()
      .png()
      .toBuffer();
  } catch (error) {
    fail(`Falha ao rasterizar ${SVG_FILE}: ${error.message}`);
  }

  const images = [];
  for (const size of SIZES) {
    let png;
    try {
      png = await sharp(base)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: "lanczos3",
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch (error) {
      fail(`Falha ao gerar o PNG ${size}×${size}: ${error.message}`);
    }

    if (png.length === 0 || !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      fail(`O PNG ${size}×${size} não foi gerado corretamente; o ícone não será escrito.`);
    }

    // Um ícone totalmente transparente é inútil no atalho: recusa gravar.
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let opaquePixels = 0;
    for (let index = 3; index < data.length; index += info.channels) {
      if (data[index] > 0) {
        opaquePixels += 1;
        break;
      }
    }
    if (opaquePixels === 0) {
      fail(`O PNG ${size}×${size} saiu totalmente transparente; verifique ${SVG_FILE}.`);
    }

    images.push({ size, png });
  }
  return images;
}

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = ícone
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = header.length + 16 * images.length;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    // 0 significa 256 no formato ICO (o byte não cabe em UInt8).
    const dimension = image.size >= 256 ? 0 : image.size;
    entry.writeUInt8(dimension, 0); // largura
    entry.writeUInt8(dimension, 1); // altura
    entry.writeUInt8(0, 2); // cores da paleta (0 = sem paleta)
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32LE(image.png.length, 8); // tamanho dos dados
    entry.writeUInt32LE(offset, 12); // deslocamento no arquivo
    offset += image.png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

async function main() {
  const svg = readSvg();
  const images = await renderPngs(svg);
  const ico = buildIco(images);

  fs.mkdirSync(path.dirname(ICO_FILE), { recursive: true });
  fs.writeFileSync(ICO_FILE, ico);

  console.log(
    `[OK] ${path.relative(ROOT, ICO_FILE)} — ${images.length} tamanhos ` +
      `(${SIZES.join(", ")}) — ${ico.length} bytes`,
  );
}

main().catch((error) => {
  fail(error?.stack || String(error));
});
