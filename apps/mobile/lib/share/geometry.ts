/**
 * Geometria do card compartilhável, em uma definição só — o layout (dp) e a
 * captura (px) precisam concordar, e eles moram em arquivos diferentes
 * (`capture.ts` no nativo, `capture.web.ts` na web).
 *
 * 360×640 dp × 3 = 1080×1920 px, a resolução de story que Instagram e WhatsApp
 * esperam. Abaixo disso o texto sai serrilhado na tela do celular de quem vê.
 */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;
export const SHARE_EXPORT_SCALE = 3;

/**
 * Faixa que o Instagram cobre com a própria interface, no topo e embaixo.
 *
 * A recomendação oficial para Stories é deixar **250px livres de texto e logo
 * em cada ponta** de um quadro de 1920 — em cima fica o avatar de quem postou
 * com a barra de progresso, embaixo a barra de responder. 250 ÷ 1920 = 13%, que
 * nos 640dp deste card dá 84.
 *
 * A FOTO pode passar por baixo dessas faixas à vontade: ela é fundo, e a
 * interface por cima dela não atrapalha. Quem precisa respeitar o limite é o
 * texto — número, macros e marca d'água ficam ilegíveis debaixo da barra de
 * responder.
 */
export const STORY_SAFE_TOP = 84;
/**
 * Embaixo vai um pouco além dos 84 do mínimo.
 *
 * Com 84 exatos a marca d'água terminava a 252px da borda — dois pixels dentro
 * do limite, o que passa na régua e encosta nela. 96dp (288px) deixa margem de
 * verdade, e é a ponta que mais importa: é onde fica a barra de responder, que
 * é opaca e alta.
 */
export const STORY_SAFE_BOTTOM = 96;
