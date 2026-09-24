import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  STORY_SAFE_BOTTOM,
  STORY_SAFE_TOP,
} from "@/lib/share/geometry";

/**
 * Espelha o quadro do `ShareCard` enquanto os dados carregam em
 * `share/[type]/[id].tsx`.
 *
 * A composição segue a do card: o respiro em cima (onde a foto vai), e embaixo
 * o bloco ancorado — data, legenda, número de kcal, barra de macros e a marca
 * d'água. Fundo neutro escuro no lugar do degradê, porque o preset e o
 * conteúdo real só se sabem depois do fetch.
 *
 * Sem raio e nas medidas de `geometry`: quem arredonda e encolhe é o
 * `CardPreview` da tela, o mesmo que envolve o card de verdade — assim os dois
 * ocupam exatamente o mesmo espaço e a troca não empurra nada.
 */
export function ShareCardSkeleton() {
  return (
    <View
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        paddingTop: STORY_SAFE_TOP,
        paddingBottom: STORY_SAFE_BOTTOM,
        paddingHorizontal: 26,
      }}
      className="justify-end overflow-hidden bg-neutral-800"
    >
      <SkeletonBlock width={64} height={12} />
      <View className="mt-3 gap-2">
        <SkeletonBlock width="85%" height={20} />
        <SkeletonBlock width="55%" height={20} />
      </View>
      <View className="mt-4">
        <SkeletonBlock width={150} height={52} />
      </View>
      <View className="mt-5 gap-3">
        <SkeletonBlock width="100%" height={10} radius={5} />
        <SkeletonBlock width="80%" height={14} />
      </View>
      <View className="mt-6">
        <SkeletonBlock width={120} height={18} />
      </View>
    </View>
  );
}
