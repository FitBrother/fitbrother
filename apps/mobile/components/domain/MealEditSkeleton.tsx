import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Placeholder de tela cheia para `meal/[id]/edit.tsx` enquanto `getMeal`
 * carrega. Espelha o `EditMealModal`: barra, chips de tipo/horário, card de
 * resumo fixo, três linhas de item com stepper, botão de adicionar e a barra
 * de salvar no rodapé.
 */
export function MealEditSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]"
      edges={["top", "left", "right"]}
    >
      <View className="h-[52px] flex-row items-center justify-between px-4">
        <SkeletonBlock width={24} height={24} radius={6} />
        <SkeletonBlock width={140} height={20} />
        <SkeletonBlock width={22} height={22} radius={6} />
      </View>

      <View className="gap-3 px-4 pb-3 pt-1">
        <View className="flex-row gap-2">
          <SkeletonBlock width={120} height={44} radius={22} />
          <SkeletonBlock width={96} height={44} radius={22} />
        </View>
        <View style={shadows.card} className="gap-3 rounded-[26px] bg-white p-5">
          <View className="flex-row items-center justify-between">
            <SkeletonBlock width={120} height={36} />
            <SkeletonBlock width={72} height={26} radius={13} />
          </View>
          <SkeletonBlock width="100%" height={6} radius={3} />
          <SkeletonBlock width="70%" height={12} />
        </View>
      </View>

      <View className="flex-1 gap-3 px-4 pt-1">
        <SkeletonBlock width={64} height={14} />
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={shadows.card}
            className="flex-row items-center gap-2 rounded-[26px] bg-white py-3 pl-4 pr-2"
          >
            <View className="flex-1 gap-2">
              <SkeletonBlock width="70%" height={16} />
              <SkeletonBlock width={64} height={12} />
            </View>
            <SkeletonBlock width={136} height={44} radius={22} />
          </View>
        ))}
        <SkeletonBlock width="100%" height={52} radius={26} />
      </View>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="border-t border-neutral-200 bg-white px-4 pt-3"
      >
        <SkeletonBlock width="100%" height={52} radius={26} />
      </View>
    </SafeAreaView>
  );
}
