import { describe, expect, test } from "@jest/globals";
import {
  COLLAPSED_SCROLL_MARGIN,
  collapseSpacer,
  collapseSpacerHeight,
  summaryMorphHeight,
  SUMMARY,
  SUMMARY_COLLAPSE_DELTA,
} from "./summary-geometry";
import { EXPAND_AT } from "./summary-collapse";

/** Faixa rolável que sobra depois do colapso, dado o spacer que a lista usa. */
function rolavelColapsado(natural: number, viewport: number): number {
  const total = collapseSpacer(natural, viewport);
  return Math.max(0, natural - SUMMARY_COLLAPSE_DELTA + total - viewport);
}

describe("summaryMorphHeight", () => {
  test("encolhe do expandido para o colapsado", () => {
    expect(summaryMorphHeight(0)).toBeGreaterThan(summaryMorphHeight(1));
  });

  /**
   * O que estende a garantia do estado final para todos os frames do meio.
   *
   * `collapseSpacer` dimensiona o branco olhando só para o estado colapsado. O
   * que impede um frame intermediário de furar o piso é a altura do conteúdo
   * ser MONÓTONA em `t`: o resumo encolhe linear, o spacer cresce linear, e
   * soma de afins é afim — então o mínimo está sempre num dos extremos, e o
   * extremo é justamente o caso que a função garante.
   *
   * Com qualquer termo curvo, a altura poderia mergulhar no meio do caminho,
   * prender o scroll durante a animação e reabrir o resumo — o bug de volta,
   * agora só no meio da transição e muito mais difícil de ver.
   *
   * É linear porque cada peça é: um spacer `lerp(a, b, t)`, um `groupGap`
   * `lerp(a, b, t)`, e a altura do morph `2r(1-t) + (sExp + (sCol-sExp)t)` —
   * todos afins em `t`.
   */
  test("a altura é linear em t", () => {
    const h0 = summaryMorphHeight(0);
    const h1 = summaryMorphHeight(1);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      expect(summaryMorphHeight(t)).toBeCloseTo(h0 + (h1 - h0) * t, 9);
    }
  });

  test("o delta bate com os 178px medidos no navegador", () => {
    // Não é um número mágico: é `summaryMorphHeight(0) - summaryMorphHeight(1)`
    // derivado de SUMMARY. O valor está cravado aqui para que mexer na
    // geometria sem pensar na compensação quebre o teste em vez do scroll.
    expect(SUMMARY_COLLAPSE_DELTA).toBe(178);
  });
});

describe("collapseSpacer", () => {
  // Medidos no navegador, viewport de 784px.
  const VIEWPORT = 784;
  const DUAS_REFEICOES = 830;
  const OITO_REFEICOES = 1832;

  /**
   * O invariante que mata o bug, e o único motivo de o spacer existir.
   *
   * Colapsar encolhe o conteúdo, e encolher conteúdo faz o navegador prender o
   * `scrollTop` no novo máximo. Se esse máximo cair abaixo de `EXPAND_AT`, o
   * offset preso volta ao handler como "usuário no topo", o resumo reexpande, o
   * conteúdo cresce, o dedo empurra de novo — e pulsa enquanto o gesto durar.
   *
   * Garantindo faixa rolável >= COLLAPSED_SCROLL_MARGIN no estado colapsado, o
   * offset preso continua bem acima do limiar e nada reabre.
   */
  test("a faixa rolável colapsada nunca cai abaixo da margem", () => {
    // A partir de qualquer conteúdo que ROLE — abaixo disso a garantia é vazia,
    // ver o teste seguinte.
    for (let natural = VIEWPORT + 1; natural <= 3000; natural += 17) {
      expect(rolavelColapsado(natural, VIEWPORT)).toBeGreaterThanOrEqual(COLLAPSED_SCROLL_MARGIN);
    }
  });

  /**
   * Conteúdo que cabe na tela não rola, e o que não rola não colapsa: o offset
   * nunca passa de zero, então nunca cruza `COLLAPSE_AT`. Não há o que
   * proteger, e o branco não aparece — o rodapé está multiplicado por um
   * colapso que fica em zero.
   *
   * Vale registrar porque a fórmula devolve o teto justamente aqui, e ler isso
   * sem o contexto sugere que uma refeição sozinha ganharia 218px de sobra.
   */
  test("lista que não rola não colapsa, e o branco calculado não chega a aparecer", () => {
    const total = collapseSpacer(VIEWPORT - 200, VIEWPORT);
    expect(total).toBe(SUMMARY_COLLAPSE_DELTA + COLLAPSED_SCROLL_MARGIN);
    expect(collapseSpacerHeight(0, total)).toBe(0);
  });

  test("a margem sobra folgada em cima do limiar que reexpande", () => {
    expect(COLLAPSED_SCROLL_MARGIN).toBeGreaterThan(EXPAND_AT);
  });

  /**
   * O pedido explícito: lista longa não ganha sobra no fim. A faixa rolável
   * dela já é enorme (1048px medidos com 8 refeições), o invariante vale
   * sozinho, e o último card termina onde sempre terminou — só com o respiro
   * do `listBottomSpace`, que já existe para o card não ficar sob o degradê.
   */
  test("lista longa não ganha espaço em branco nenhum", () => {
    expect(collapseSpacer(OITO_REFEICOES, VIEWPORT)).toBe(0);
  });

  test("lista curta ganha só o que falta para o colapso parar de pé", () => {
    const total = collapseSpacer(DUAS_REFEICOES, VIEWPORT);
    expect(total).toBeGreaterThan(0);
    // Exatamente o que falta: a faixa rolável colapsada bate a margem, sem
    // sobrar um pixel além.
    expect(rolavelColapsado(DUAS_REFEICOES, VIEWPORT)).toBe(COLLAPSED_SCROLL_MARGIN);
  });

  test("o branco encolhe conforme a lista cresce, até zerar", () => {
    let anterior = Infinity;
    for (let natural = VIEWPORT; natural <= VIEWPORT + 400; natural += 40) {
      const total = collapseSpacer(natural, VIEWPORT);
      expect(total).toBeLessThanOrEqual(anterior);
      anterior = total;
    }
    expect(collapseSpacer(VIEWPORT + 400, VIEWPORT)).toBe(0);
  });

  test("nunca passa do que o colapso tira mais a margem", () => {
    for (let natural = 0; natural <= 3000; natural += 17) {
      expect(collapseSpacer(natural, VIEWPORT)).toBeLessThanOrEqual(
        SUMMARY_COLLAPSE_DELTA + COLLAPSED_SCROLL_MARGIN,
      );
    }
  });
});

describe("collapseSpacerHeight", () => {
  test("não ocupa espaço nenhum com o resumo expandido", () => {
    // O branco só existe no estado que precisa dele. Expandido, a lista
    // termina no último card como sempre terminou — e é isso que faz a medida
    // do conteúdo natural, tirada nesse estado, não incluir o próprio spacer.
    expect(collapseSpacerHeight(0, 172)).toBe(0);
  });

  test("colapsado ocupa o total calculado", () => {
    expect(collapseSpacerHeight(1, 172)).toBe(172);
  });

  test("t fora de [0,1] não passa dos extremos", () => {
    // A mola tem overshoot de propósito; sem prender, o repique daria ao
    // spacer altura negativa (conteúdo encolhendo além do colapsado).
    expect(collapseSpacerHeight(-0.4, 172)).toBe(0);
    expect(collapseSpacerHeight(1.6, 172)).toBe(172);
  });
});

describe("SUMMARY", () => {
  test("colapsado é mais fino e mais curto em cada peça", () => {
    for (const g of [SUMMARY.kcal, SUMMARY.macro]) {
      expect(g.strokeCollapsed).toBeLessThan(g.strokeExpanded);
      expect(g.lead).toBeGreaterThan(0);
    }
    expect(SUMMARY.groupGap[1]).toBeLessThan(SUMMARY.groupGap[0]);
  });
});
