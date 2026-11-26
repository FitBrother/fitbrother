import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Placeholder de tela cheia para `meal/[id]/index.tsx` enquanto `getMeal`
 * carrega. Espelha o `MealEditor`: barra, chips de tipo/horário, card de
 * resumo, cartão de feedback da IA, três linhas de item com stepper, botão de
 * adicionar e os dois botões de compartilhar. A barra de salvar não entra:
 * ela só existe quando há alteração.
 */
export function MealEditSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      testID="meal-edit-skeleton"
      className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center px-4 py-2">
        <View className="h-[44px] w-[44px] items-center justify-center">
          <SkeletonBlock width={24} height={24} radius={6} />
        </View>
        <View className="ml-2 flex-1">
          <SkeletonBlock width={120} height={24} />
        </View>
        <View className="h-[44px] w-[44px] items-center justify-center">
          <SkeletonBlock width={22} height={22} radius={6} />
        </View>
      </View>

      <View className="gap-3 px-4 pb-3 pt-1">
        <View className="flex-row gap-2">
          <SkeletonBlock width={128} height={44} radius={22} />
          <SkeletonBlock width={96} height={44} radius={22} />
        </View>
        <View style={shadows.card} className="rounded-[26px] bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <SkeletonBlock width={120} height={40} />
            <SkeletonBlock width={72} height={28} radius={14} />
          </View>
          <SkeletonBlock width="100%" height={6} radius={3} />
          <View className="mt-2.5 flex-row gap-3">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-1">
                <SkeletonBlock width="80%" height={16} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="flex-1 gap-3 px-4 pt-1" style={{ paddingBottom: insets.bottom + 24 }}>
        <SkeletonBlock width="100%" height={56} radius={16} />
        <SkeletonBlock width={72} height={20} />
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={shadows.card}
            className="flex-row items-center gap-2 rounded-[26px] bg-white py-2 pl-4 pr-2"
          >
            <View className="flex-1 gap-2">
              <SkeletonBlock width="70%" height={18} />
              <SkeletonBlock width={64} height={14} />
            </View>
            <SkeletonBlock width={136} height={44} radius={22} />
          </View>
        ))}
        <SkeletonBlock width="100%" height={52} radius={26} />
        <View className="mt-3 gap-2">
          <SkeletonBlock width="100%" height={52} radius={26} />
          <SkeletonBlock width="100%" height={52} radius={26} />
        </View>
      </View>
    </SafeAreaView>
  );
}
