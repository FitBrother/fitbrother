import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Placeholder de tela cheia para `meal/[id]/index.tsx` enquanto `getMeal`
 * carrega. Espelha o card de totais (kcal + legenda de macros + faixa de
 * proporção) e a lista de itens (`MealItemRowSwipeable`) — mesmo padrão de
 * `HomeSkeleton`: sem cabeçalho, o corpo inteiro é substituído.
 */
export function MealDetailSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View style={shadows.card} className="mx-4 mt-4 overflow-hidden rounded-[26px] bg-white">
        <View className="flex-row items-center justify-between gap-2 p-4">
          <View className="flex-row items-baseline gap-1.5">
            <SkeletonBlock width={72} height={30} />
            <SkeletonBlock width={32} height={16} />
          </View>
          <SkeletonBlock width={120} height={16} />
        </View>
        <SkeletonBlock width="100%" height={6} radius={0} />
      </View>

      <SkeletonBlock width={56} height={12} radius={4} style={{ marginLeft: 16, marginTop: 20 }} />
      <View className="mx-4 mt-2 gap-2">
        {[0, 1, 2].map((i) => (
          <View key={i} style={shadows.card} className="overflow-hidden rounded-[26px] bg-white">
            <View className="gap-1.5 p-4">
              <SkeletonBlock width="55%" height={16} />
              <View className="flex-row items-center justify-between gap-2">
                <SkeletonBlock width={140} height={13} />
                <SkeletonBlock width={64} height={12} />
              </View>
            </View>
            <SkeletonBlock width="100%" height={6} radius={0} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
