/**
 * Decisão de colapso do resumo diário da Home.
 *
 * Mora fora do componente porque a regra é sutil e o custo de errar é um bug
 * difícil de ver: a versão anterior disparava pela DIREÇÃO do gesto e entrava
 * em loop com a própria animação (ver comentário sobre realimentação abaixo).
 * Como função pura, a regra fica sob teste.
 */

/**
 * Acima deste offset o resumo colapsa, em px.
 *
 * Não é zero para o resumo não achatar no primeiro pixel de arrasto — e para o
 * quique elástico do iOS/Safari, que passeia por offsets pequenos, não valer
 * como intenção de rolar.
 */
export const COLLAPSE_AT = 24;

/**
 * Abaixo deste offset o resumo volta a expandir, em px.
 *
 * Menor que COLLAPSE_AT de propósito: a faixa entre os dois é uma histerese.
 * Com um limiar só, parar o dedo em cima dele fazia o resumo piscar entre os
 * dois estados a cada tremor de scroll.
 */
export const EXPAND_AT = 8;

/**
 * Próximo alvo do colapso: 0 = expandido (anéis), 1 = colapsado (barras).
 *
 * A regra é de POSIÇÃO, não de direção, e é isso que mantém o resumo estável.
 * A versão por direção ("desceu colapsa, subiu expande") se retroalimentava:
 * colapsar muda a altura do bloco, o navegador reancora o `scrollTop` para
 * caber no novo tamanho do conteúdo, e esse reajuste chega ao handler como um
 * delta negativo — indistinguível de o usuário ter subido o dedo. O resumo
 * expandia sozinho, a altura voltava, e o ciclo recomeçava a cada frame.
 *
 * Por posição isso não fecha: um reajuste no fim da lista deixa o offset em
 * centenas de px, longe de EXPAND_AT, então nada reabre. O resumo só volta a
 * expandir quando o usuário realmente traz a lista de volta ao topo.
 */
export function nextCollapse({ y, current }: { y: number; current: 0 | 1 }): 0 | 1 {
  "worklet";
  if (y <= EXPAND_AT) return 0;
  if (y > COLLAPSE_AT) return 1;
  return current;
}
