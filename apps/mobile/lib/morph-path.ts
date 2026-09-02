/**
 * Geometria do anel que achata em barra (resumo diário colapsável).
 *
 * Anel e barra são o MESMO conjunto de N+1 pontos, parametrizados por fração
 * de comprimento: o ponto i está a `i/N` do caminho nos dois casos. O morph é
 * a interpolação ponto a ponto entre eles.
 *
 * Duas propriedades caem de graça dessa escolha:
 *
 * 1. A altura em qualquer `t` é `2r(1-t)`, monótona decrescente — o expandido
 *    é o teto por construção, não por clamp. (Desenrolar o anel mantendo o
 *    comprimento do traço, que seria o morph fisicamente honesto, faz o raio
 *    crescer e o container INCHA no meio do caminho: um arco de 270° é mais
 *    alto que o círculo que o originou.)
 * 2. O preenchimento é o mesmo corte nos dois estados. 59% dos pontos é 59%
 *    do anel a partir do topo e 59% da barra a partir da esquerda, sem
 *    lógica separada por estado.
 */

/** Pontos por caminho. 64 já não mostra facetamento num anel de 160px. */
export const MORPH_STEPS = 64;

export type MorphEndpoints = {
  /** Pontos do anel (t=0), achatados: [x0, y0, x1, y1, ...]. */
  ring: number[];
  /** Pontos da barra (t=1), mesmo formato e mesma parametrização. */
  bar: number[];
  steps: number;
};

/**
 * Pré-calcula os dois extremos do morph. Não depende de `t`, então roda uma
 * vez por geometria — o worklet de cada frame só interpola.
 *
 * O anel começa no topo e corre em sentido horário (mesma origem do
 * ProgressRing) e a barra corre da esquerda pra direita. Ambos com y=0 no
 * ponto inicial, então o traço encosta no topo da caixa nos dois estados e
 * `dy` vira uma constante (metade da espessura).
 */
export function morphEndpoints(
  radius: number,
  barWidth: number,
  boxWidth: number,
  steps: number = MORPH_STEPS,
): MorphEndpoints {
  const ring: number[] = [];
  const bar: number[] = [];
  const cx = boxWidth / 2;
  const barLeft = (boxWidth - barWidth) / 2;

  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push(cx + radius * Math.sin(a), radius - radius * Math.cos(a));
    bar.push(barLeft + (barWidth * i) / steps, 0);
  }

  return { ring, bar, steps };
}

/** Altura ocupada pelo traço, incluindo a espessura. Decresce com `t`. */
export function morphHeight(t: number, radius: number, strokeWidth: number): number {
  "worklet";
  return 2 * radius * (1 - t) + strokeWidth;
}

/** Arredonda pra 1 casa. Evita strings de path com 17 dígitos por coordenada. */
function round1(n: number): number {
  "worklet";
  return ((n * 10 + 0.5) | 0) / 10;
}

/**
 * Monta o `d` do path no estado `t`, cortado em `progress` (0..1) do
 * comprimento. O último segmento é interpolado em vez de arredondado pro
 * ponto mais próximo — sem isso o preenchimento anda aos saltos de 1,6%
 * enquanto o valor anima na montagem.
 */
export function morphPath(e: MorphEndpoints, t: number, progress: number, dy: number): string {
  "worklet";
  const n = e.steps;
  const ring = e.ring;
  const bar = e.bar;
  const cut = Math.max(0, Math.min(1, progress)) * n;
  const full = Math.floor(cut);
  const frac = cut - full;

  let d = "";
  for (let i = 0; i <= full; i++) {
    const j = i * 2;
    const x = ring[j]! + (bar[j]! - ring[j]!) * t;
    const y = ring[j + 1]! + (bar[j + 1]! - ring[j + 1]!) * t;
    d += (i === 0 ? "M" : "L") + round1(x) + " " + round1(y + dy);
  }

  // Ponta parcial: interpola entre o último ponto inteiro e o próximo.
  if (frac > 0 && full < n) {
    const j = full * 2;
    const k = j + 2;
    const x0 = ring[j]! + (bar[j]! - ring[j]!) * t;
    const y0 = ring[j + 1]! + (bar[j + 1]! - ring[j + 1]!) * t;
    const x1 = ring[k]! + (bar[k]! - ring[k]!) * t;
    const y1 = ring[k + 1]! + (bar[k + 1]! - ring[k + 1]!) * t;
    d += "L" + round1(x0 + (x1 - x0) * frac) + " " + round1(y0 + (y1 - y0) * frac + dy);
  }

  return d;
}
