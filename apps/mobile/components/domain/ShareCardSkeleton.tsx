import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";

/**
 * Espelha o frame 9:16 do `ShareCard` (título no topo, número de kcal grande,
 * linha de macros e o selo no rodapé) enquanto os dados do card ainda
 * carregam em `share/[type]/[id].tsx`. Fundo neutro escuro no lugar do
 * gradiente — o conteúdo real (foto/gradiente) só se sabe depois do fetch.
 */
export function ShareCardSkeleton() {
  return (
    <View
      style={{ width: 360, aspectRatio: 9 / 16 }}
      className="justify-between overflow-hidden rounded-[26px] bg-neutral-800 p-7"
    >
      <SkeletonBlock width="70%" height={28} />
      <View className="gap-3">
        <SkeletonBlock width={140} height={56} />
        <SkeletonBlock width={100} height={16} />
        <SkeletonBlock width={220} height={22} />
      </View>
      <SkeletonBlock width={90} height={24} />
    </View>
  );
}
