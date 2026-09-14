import { LinearGradient } from "expo-linear-gradient";

/**
 * Cor de fundo da tela (`neutral-50`) em canal RGB. Mesma exceção do
 * ComposerBackdrop: gradiente precisa da cor em formato próprio.
 */
const CANVAS_RGB = "248, 250, 252";

/** Altura do trecho em degradê, em px. */
export const LIST_TOP_FADE_HEIGHT = 24;

/**
 * Degradê no topo da lista de refeições — o espelho do ComposerBackdrop.
 *
 * Com o resumo e o título "Refeições" fixos acima da lista, um card que sobe
 * some num corte reto na borda superior dela. Este degradê dissolve o card
 * nesses 24px antes do corte, para ele desaparecer sob o título em vez de ser
 * decepado por ele.
 *
 * A curva é a inversa da do rodapé: opaco encostado no título, transparente na
 * ponta de baixo.
 *
 * Mora dentro do cabeçalho fixo da lista e se pendura para fora dele
 * (`top: 100%`), porque é logo abaixo da borda do cabeçalho que os cards
 * passam por baixo. Ficar ancorado no topo do container da lista não serve
 * mais: o cabeçalho é quem ocupa essa faixa agora, e cobriria o degradê.
 */
export function ListTopFade() {
  return (
    <LinearGradient
      colors={[
        `rgba(${CANVAS_RGB}, 1)`,
        `rgba(${CANVAS_RGB}, 0.85)`,
        `rgba(${CANVAS_RGB}, 0.5)`,
        `rgba(${CANVAS_RGB}, 0)`,
      ]}
      locations={[0, 0.3, 0.65, 1]}
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        height: LIST_TOP_FADE_HEIGHT,
        zIndex: 1,
      }}
    />
  );
}
