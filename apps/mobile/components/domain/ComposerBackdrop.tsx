import { LinearGradient } from "expo-linear-gradient";
import { LIST_TOP_FADE_HEIGHT } from "./ListTopFade";

/**
 * Cor de fundo da tela (`neutral-50`) em canal RGB, para montar as paradas do
 * gradiente. Hex direto seria proibido em JSX, mas gradiente é a exceção da
 * regra — como SVG/Skia, precisa da cor em formato próprio.
 */
const CANVAS_RGB = "248, 250, 252";

/**
 * Altura do trecho em degradê, em px. Derivada do fade do topo em vez de
 * escrita à mão: os dois emolduram a mesma lista, e com 88 aqui contra 24 lá a
 * moldura ficava visivelmente torta. Amarrar as duas pontas impede a diferença
 * de voltar sem que alguém decida por ela.
 */
export const COMPOSER_FADE_HEIGHT = LIST_TOP_FADE_HEIGHT;

/**
 * Paradas do degradê, do topo (transparente) até a base (opaco).
 *
 * A última parada é obrigatoriamente `alpha: 1`: abaixo dela começa o bloco
 * sólido do composer, e qualquer valor menor vira uma linha visível onde o
 * card parece sumir de repente. Foi esse o defeito — o gradiente antigo
 * cruzava o topo do bloco sólido ainda em ~59%.
 *
 * A curva é ease-out: sobe rápido no começo e desacelera ao chegar no sólido.
 * O trecho colado no bloco sólido é o de menor variação, que é justamente o
 * que torna a emenda imperceptível — uma rampa linear ainda "chega" de forma
 * abrupta.
 */
export const FADE_STOPS = [
  { alpha: 0, location: 0 },
  { alpha: 0.5, location: 0.35 },
  { alpha: 0.85, location: 0.7 },
  { alpha: 1, location: 1 },
] as const;

// O LinearGradient exige tuplas de no mínimo dois elementos, e um `.map` sobre
// FADE_STOPS produziria array simples. As duas primeiras posições são escritas
// à mão para satisfazer a tupla; o resto é derivado.
const FADE_COLORS: readonly [string, string, ...string[]] = [
  `rgba(${CANVAS_RGB}, ${FADE_STOPS[0].alpha})`,
  `rgba(${CANVAS_RGB}, ${FADE_STOPS[1].alpha})`,
  ...FADE_STOPS.slice(2).map((stop) => `rgba(${CANVAS_RGB}, ${stop.alpha})`),
];

const FADE_LOCATIONS: readonly [number, number, ...number[]] = [
  FADE_STOPS[0].location,
  FADE_STOPS[1].location,
  ...FADE_STOPS.slice(2).map((stop) => stop.location),
];

/**
 * Degradê que emenda a lista de refeições no bloco sólido do composer.
 *
 * Fica ancorado em `bottom: "100%"` — ou seja, imediatamente acima do irmão
 * que o precede, seja qual for a altura dele. É o que mantém a emenda correta
 * quando o input cresce para várias linhas.
 */
export function ComposerBackdrop() {
  return (
    <LinearGradient
      colors={FADE_COLORS}
      locations={FADE_LOCATIONS}
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "100%",
        height: COMPOSER_FADE_HEIGHT,
      }}
    />
  );
}
