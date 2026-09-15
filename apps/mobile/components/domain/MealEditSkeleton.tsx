import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

const MACRO_FIELDS = ["kcal", "protein", "carbs", "fat"];

/**
 * Placeholder de tela cheia para `meal/[id]/edit.tsx` enquanto `getMeal`
 * carrega (o `EditMealModal` só monta depois que a refeição chega). Espelha
 * dois cards de item — descrição, qtd/unidade, kcal/P/C/G — e o card de
 * totais no rodapé, no shape do formulário real.
 */
export function MealEditSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      {[0, 1].map((i) => (
        <View key={i} style={shadows.card} className="mx-4 mt-3 gap-3 rounded-2xl bg-white p-4">
          <SkeletonBlock width="70%" height={18} />

          <View className="flex-row items-center gap-2">
            <View className="flex-1 gap-1">
              <SkeletonBlock width={28} height={10} radius={3} />
              <SkeletonBlock width="100%" height={32} radius={8} />
            </View>
            <View className="gap-1">
              <SkeletonBlock width={50} height={10} radius={3} />
              <SkeletonBlock width={80} height={32} radius={8} />
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {MACRO_FIELDS.map((key) => (
              <View key={key} className="flex-1 gap-1">
                <SkeletonBlock width={28} height={10} radius={3} />
                <SkeletonBlock width="100%" height={32} radius={8} />
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={shadows.card} className="mx-4 mt-5 gap-1.5 rounded-2xl bg-white p-4">
        <SkeletonBlock width={56} height={11} radius={4} />
        <SkeletonBlock width={130} height={22} />
        <SkeletonBlock width={180} height={13} />
      </View>
    </SafeAreaView>
  );
}
