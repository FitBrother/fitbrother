/**
 * Geometria do resumo diário nos dois estados, e a compensação de altura que
 * mantém a lista de refeições rolável durante o colapso.
 *
 * Mora fora do componente pelo mesmo motivo de `summary-collapse.ts`: a regra é
 * sutil, o custo de errar é um bug de scroll difícil de ver, e como módulo puro
 * ela fica sob teste sem precisar montar a árvore do React Native.
 */

/**
 * Geometria do resumo nos dois estados. Fica num objeto só porque a altura do
 * bloco é derivada daqui em quatro lugares (spacers, posição dos textos, a
 * altura que o morph reporta e a compensação abaixo) — constantes soltas saíam
 * de sintonia.
 */
export const SUMMARY = {
  kcal: {
    radius: 73,
    strokeExpanded: 14,
    strokeCollapsed: 10,
    /** Respiro acima da barra onde os números pousam no estado colapsado. */
    lead: 34,
    valueFont: 30,
    valueFontCollapsed: 17,
    subFont: 12,
    subFontCollapsed: 11,
    /** Centro vertical dos textos: expandido (dentro do anel) → colapsado. */
    valueY: [72, 15],
    subY: [96, 16],
    /** Folga entre o número e o "/ meta" quando ficam lado a lado. */
    gap: 6,
  },
  macro: {
    radius: 36,
    strokeExpanded: 8,
    strokeCollapsed: 6,
    lead: 24,
    valueFont: 18,
    valueFontCollapsed: 12,
    subFont: 12,
    subFontCollapsed: 11,
    valueY: [33, 10],
    subY: [50, 10],
    /** Folga entre o número e a meta quando ficam lado a lado. */
    gap: 3,
  },
  /** Espaço entre o bloco de calorias e a linha de macros. */
  groupGap: [24, 12],
} as const;

type MorphGroup = {
  radius: number;
  strokeExpanded: number;
  strokeCollapsed: number;
  lead: number;
};

function lerp(a: number, b: number, t: number): number {
  "worklet";
  return a + (b - a) * t;
}

/** Altura de um bloco (spacer de respiro + traço) no estado `t`. */
function alturaBloco(g: MorphGroup, t: number): number {
  "worklet";
  const stroke = lerp(g.strokeExpanded, g.strokeCollapsed, t);
  // Espelha `morphHeight` de morph-path.ts: o traço achata e o spacer acima
  // dele cresce para os números pousarem onde o anel deixou de estar.
  return lerp(0, g.lead, t) + 2 * g.radius * (1 - t) + stroke;
}

/**
 * Altura das partes do resumo que mudam com o colapso, no estado `t`.
 *
 * Só as partes MÓVEIS: o rótulo de cada macro, o padding do card e o resto do
 * cabeçalho têm altura fixa e não entram na conta, porque a compensação só
 * precisa cobrir o que se mexe.
 *
 * ⚠️ Espelha a composição do JSX de `TodaySummaryHeader`. Se entrar ou sair uma
 * peça de altura variável lá, ela precisa entrar aqui também — o teste crava o
 * delta em 178px justamente para que essa dessincronia apareça como falha.
 */
export function summaryMorphHeight(t: number): number {
  "worklet";
  return (
    alturaBloco(SUMMARY.kcal, t) +
    lerp(SUMMARY.groupGap[0], SUMMARY.groupGap[1], t) +
    alturaBloco(SUMMARY.macro, t)
  );
}

/**
 * Quanto o resumo encolhe do expandido ao colapsado, em px.
 *
 * Derivado, não medido: bate exatamente com os 178px observados no navegador.
 */
export const SUMMARY_COLLAPSE_DELTA = summaryMorphHeight(0) - summaryMorphHeight(1);

/**
 * Faixa rolável que precisa sobrar no estado colapsado, em px.
 *
 * Acima de `EXPAND_AT` (8) com folga, e acima também de `COLLAPSE_AT` (24): o
 * offset que dispara o colapso precisa continuar alcançável DEPOIS que o
 * conteúdo encolheu, senão o navegador o prende num valor menor e o resumo lê
 * isso como volta ao topo.
 */
export const COLLAPSED_SCROLL_MARGIN = 40;

/**
 * Altura do espaço em branco que fecha a lista de refeições — só o que faltar
 * para o colapso ser estável, e nada além disso.
 *
 * O problema: colapsar tira 178px de conteúdo. Numa lista curta isso é mais do
 * que a faixa rolável inteira (medido com 2 refeições: 46px), então o navegador
 * prende o `scrollTop` no máximo possível — zero — e esse zero volta ao handler
 * como se o usuário tivesse retornado ao topo. `nextCollapse` reexpande, o
 * conteúdo cresce, o dedo empurra o offset acima do limiar de novo, e o resumo
 * pulsa entre os dois estados enquanto o gesto durar.
 *
 * O invariante que resolve: **a faixa rolável do estado colapsado nunca fica
 * abaixo de `COLLAPSED_SCROLL_MARGIN`**. Assim, mesmo que colapsar force um
 * reajuste do scroll, o offset resultante ainda está bem acima de `EXPAND_AT` e
 * nada reabre.
 *
 * O branco é o MÍNIMO para isso, não uma compensação cheia dos 178px: numa
 * lista longa a faixa rolável já é enorme, o invariante vale sozinho e a função
 * devolve zero — a lista termina logo depois do último card, sem sobra. Ele só
 * cresce à medida que a lista encurta, que é exatamente quando falta chão.
 *
 * Uma lista que nem rola devolve o teto e não usa: sem rolagem o resumo nunca
 * colapsa, então o spacer fica multiplicado por zero e não aparece.
 *
 * @param natural  altura do conteúdo com o resumo EXPANDIDO (spacer valendo 0).
 * @param viewport altura visível da lista.
 */
export function collapseSpacer(natural: number, viewport: number): number {
  const rolavel = Math.max(0, natural - viewport);
  return Math.max(0, SUMMARY_COLLAPSE_DELTA + COLLAPSED_SCROLL_MARGIN - rolavel);
}

/**
 * Altura do spacer no estado `t`, dado o total que `collapseSpacer` calculou.
 *
 * Cresce junto com o colapso para o branco só existir no estado que precisa
 * dele: expandido é zero e a lista termina no último card como sempre.
 *
 * `t` é preso em [0,1] porque a mola tem overshoot de propósito — no repique um
 * spacer de altura negativa encolheria o conteúdo abaixo do próprio colapsado.
 */
export function collapseSpacerHeight(t: number, total: number): number {
  "worklet";
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return total * k;
}
