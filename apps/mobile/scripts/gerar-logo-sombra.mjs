// Assa a sombra do logo branco num PNG: `assets/brand/logo-horizontal-branco-sombra.png`.
//
// Precisa ser assada porque o html2canvas não desenha `filter: drop-shadow`, e
// sombra de view sobre imagem transparente seria um retângulo. Com o PNG, o
// editor, o export na web e o nativo mostram o mesmo pixel.
//
// Rode de `apps/mobile`: node scripts/gerar-logo-sombra.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const MARGEM = 24;
const RAIO = 10;
const PASSES = 3;
const OPACIDADE = 0.45;
const DESCE = 2;
const INK = [0x04, 0x10, 0x0c];

const logo = PNG.sync.read(readFileSync("assets/brand/logo-horizontal-branco.png"));
const w = logo.width + MARGEM * 2;
const h = logo.height + MARGEM * 2;

let alpha = new Float32Array(w * h);
for (let y = 0; y < logo.height; y++) {
  for (let x = 0; x < logo.width; x++) {
    const destino = (y + MARGEM + DESCE) * w + x + MARGEM;
    if (destino < alpha.length) alpha[destino] = logo.data[(y * logo.width + x) * 4 + 3] / 255;
  }
}

// Blur em caixa, três passes: dá praticamente uma gaussiana.
function passe(fonte, passo, total, linhas) {
  const saida = new Float32Array(fonte.length);
  for (let l = 0; l < linhas; l++) {
    const base = l * (passo === 1 ? w : 1);
    const avanco = passo === 1 ? 1 : w;
    let soma = 0;
    for (let i = -RAIO; i <= RAIO; i++) {
      soma += fonte[base + Math.min(Math.max(i, 0), total - 1) * avanco];
    }
    for (let i = 0; i < total; i++) {
      saida[base + i * avanco] = soma / (RAIO * 2 + 1);
      soma += fonte[base + Math.min(i + RAIO + 1, total - 1) * avanco];
      soma -= fonte[base + Math.max(i - RAIO, 0) * avanco];
    }
  }
  return saida;
}
for (let p = 0; p < PASSES; p++) {
  alpha = passe(alpha, 1, w, h);
  alpha = passe(alpha, w, h, w);
}

const saida = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const dentro =
      x >= MARGEM && y >= MARGEM && x < logo.width + MARGEM && y < logo.height + MARGEM;
    const j = dentro ? ((y - MARGEM) * logo.width + (x - MARGEM)) * 4 : -1;
    const aLogo = dentro ? logo.data[j + 3] / 255 : 0;
    const aSombra = alpha[y * w + x] * OPACIDADE;
    const a = aLogo + aSombra * (1 - aLogo);
    for (let c = 0; c < 3; c++) {
      const cor = dentro ? logo.data[j + c] : 255;
      saida.data[i + c] = a > 0 ? Math.round((cor * aLogo + INK[c] * aSombra * (1 - aLogo)) / a) : 0;
    }
    saida.data[i + 3] = Math.round(a * 255);
  }
}
writeFileSync("assets/brand/logo-horizontal-branco-sombra.png", PNG.sync.write(saida));
console.log(`${w}×${h}`);
