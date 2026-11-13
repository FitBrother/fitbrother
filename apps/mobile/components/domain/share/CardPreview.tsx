import { View } from "react-native";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import type { ReactNode } from "react";

/**
 * Encolhe o card para caber no quadro da tela.
 *
 * O `scale` do RN parte do centro, então o filho em tamanho cheio é ancorado
 * meio quadro acima e à esquerda — assim o conteúdo escalado acaba exatamente
 * preenchendo o contêiner já reduzido. O raio fica AQUI, e não no card: dentro
 * da captura, ele deixaria os cantos do PNG transparentes.
 */
export function CardPreview({
  escala,
  transparente = false,
  children,
  testID,
}: {
  escala: number;
  /** Sem fundo próprio, para a câmera aparecer por trás. */
  transparente?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  if (escala <= 0) return null;
  const largura = SHARE_CARD_WIDTH * escala;
  const altura = SHARE_CARD_HEIGHT * escala;

  return (
    <View
      testID={testID}
      style={{ width: largura, height: altura, borderRadius: 18 }}
      className={transparente ? "overflow-hidden" : "overflow-hidden bg-ink"}
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
