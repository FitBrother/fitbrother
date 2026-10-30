import { View } from "react-native";
import { ShareCard, type ShareCardData } from "@/components/domain/ShareCard";
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
import { CardPreview } from "./CardPreview";

import type { Enquadramento, Tamanho } from "@/lib/media/crop";
import type { SharePreset } from "@/lib/share/presets";

/**
 * O carrossel de presets: uma cena por preset, cada uma com o card inteiro
 * encolhido para caber na tela.
 *
 * Não captura nada — a captura acontece no palco em tamanho cheio, fora da
 * tela, porque aqui o card vive dentro de um `Animated.View` com translateX e a
 * geometria do PNG sairia errada.
 */
export function SharePresetCarousel({
  presets,
  index,
  onIndexChange,
  data,
  enquadramento,
  fotoNatural,
  escala,
}: {
  presets: readonly SharePreset[];
  index: number;
  onIndexChange: (index: number) => void;
  data: ShareCardData;
  enquadramento?: Enquadramento;
  fotoNatural?: Tamanho | null;
  escala: number;
}) {
  return (
    <SwipeableTabs index={index} onIndexChange={onIndexChange}>
      {presets.map((p) => (
        <View key={p.id} className="flex-1 items-center justify-center">
          <CardPreview escala={escala}>
            <ShareCard
              data={data}
              preset={p}
              enquadramento={enquadramento}
              fotoNatural={fotoNatural}
            />
          </CardPreview>
        </View>
      ))}
    </SwipeableTabs>
  );
}
