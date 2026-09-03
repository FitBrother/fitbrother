import { Easing } from "react-native-reanimated";

export const Motion = {
  // Durações em milissegundos.
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: {
    standard: Easing.bezier(0.4, 0, 0.2, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
    accelerate: Easing.bezier(0.4, 0, 1, 1),
  },
  spring: {
    /**
     * Mola do resumo colapsável da Home (anéis ⇄ barras).
     *
     * Mola, e não `withTiming`, porque quem dispara é o scroll. Com timing, o
     * usuário que inverte o gesto no meio da transição vê uma estacada: a
     * curva recomeça do zero, velocidade zero, ignorando o movimento que já
     * estava em andamento. A mola parte da velocidade que existe e emenda.
     *
     * Razão de amortecimento 0,9 (`damping / 2√(stiffness·mass)`), logo abaixo
     * do crítico: assenta rápido e sem tremer. A default do Reanimated fica em
     * 0,5 e passa ~16% do alvo — foi o que já tinha soado errado no
     * SwipeableTabs.
     *
     * Sem `overshootClamping`, de propósito. Ele parecia a proteção óbvia
     * (o morph extrapola fora de [0,1] e quebra), mas o Reanimated o
     * implementa encerrando a animação assim que o valor passa do ponto de
     * partida — e numa inversão de gesto o valor parte com velocidade na
     * direção contrária, então a mola terminava no primeiro frame e cravava o
     * alvo. Medido: salto de 151px num frame, o oposto da continuidade que a
     * mola existe para dar. Quem protege a geometria agora é o `clamp01` de
     * `morph-path.ts`, que é onde a restrição mora.
     */
    morph: { mass: 1, damping: 22, stiffness: 150 },
  },
} as const;
