import { View } from "react-native";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import { shadows } from "@/lib/shadows";

import type { ReactNode } from "react";

/**
 * Encolhe o card para caber no preview.
 *
 * O `scale` do RN parte do centro, então o filho em tamanho cheio é ancorado
 * meio quadro acima e à esquerda — assim o conteúdo escalado acaba exatamente
 * preenchendo o contêiner já reduzido. O raio e a sombra ficam AQUI, e não no
 * card: dentro da captura, o raio deixaria os cantos do PNG transparentes.
 */
export function CardPreview({ escala, children }: { escala: number; children: ReactNode }) {
  if (escala <= 0) return null;
  const largura = SHARE_CARD_WIDTH * escala;
  const altura = SHARE_CARD_HEIGHT * escala;

  return (
    <View
      style={[shadows.floating, { width: largura, height: altura, borderRadius: 26 }]}
      className="overflow-hidden bg-white"
    >
      <View
        style={{
          position: "absolute",
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          left: -(SHARE_CARD_WIDTH - largura) / 2,
          top: -(SHARE_CARD_HEIGHT - altura) / 2,
          transform: [{ scale: escala }],
        }}
      >
        {children}
      </View>
    </View>
  );
}
