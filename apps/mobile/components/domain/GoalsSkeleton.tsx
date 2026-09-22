import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";

/**
 * Placeholder de tela cheia para `(app)/goals.tsx` enquanto perfil, meta
 * vigente e antropometria carregam. Espelha o shape real da aba "Calorias &
 * macros" (a aba default): tab bar, card de calorias com o slider hero, e o
 * card de distribuição com a barra empilhada + 3 linhas de macro — cada uma
 * no formato exato de `SliderInput` (stepper + trilha), pra não haver salto
 * de layout quando os dados chegam.
 */
export function GoalsSkeleton() {
  return (
    <View className="gap-5">
      <View className="flex-row gap-1 rounded-full bg-neutral-100 p-1">
        <SkeletonBlock width="100%" height={28} radius={999} style={{ flex: 1 }} />
        <SkeletonBlock width="100%" height={28} radius={999} style={{ flex: 1 }} />
      </View>

      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <SkeletonBlock width={120} height={11} radius={4} style={{ alignSelf: "center" }} />
        <SkeletonBlock width={150} height={38} radius={8} style={{ alignSelf: "center" }} />
        <View style={{ marginTop: 4 }}>
          <SliderRowSkeleton />
        </View>
      </View>

      <View className="gap-1 rounded-2xl border border-neutral-200 bg-white p-4">
        <SkeletonBlock width={150} height={11} radius={4} />
        <SkeletonBlock width="100%" height={10} radius={999} style={{ marginTop: 8 }} />
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className={i === 0 ? "mt-4 gap-2" : "mt-4 gap-2 border-t border-neutral-100 pt-4"}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <SkeletonCircle size={10} />
                <SkeletonBlock width={90} height={13} radius={4} />
              </View>
              <SkeletonBlock width={34} height={16} radius={999} />
            </View>
            <SliderRowSkeleton />
          </View>
        ))}
      </View>

      <SkeletonBlock width="100%" height={52} radius={26} />
      <SkeletonBlock width={220} height={11} radius={4} style={{ alignSelf: "center" }} />
    </View>
  );
}

/** Mesma composição de `SliderInput`: label + stepper (−/campo/+) + trilha. */
function SliderRowSkeleton() {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <SkeletonBlock width={70} height={12} radius={4} />
        <View className="flex-row items-center gap-1">
          <SkeletonCircle size={44} />
          <SkeletonBlock width={64} height={44} radius={10} />
          <SkeletonCircle size={44} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={6} radius={3} />
    </View>
  );
}
