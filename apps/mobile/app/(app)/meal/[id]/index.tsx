import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react-native";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { backOrHome } from "@/lib/navigation";
import { colors } from "@/lib/colors";
import { MealEditor } from "@/components/domain/MealEditor";
import { MealEditSkeleton } from "@/components/domain/MealEditSkeleton";

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useQuery({
    queryKey: mealDetailKey(id ?? ""),
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return <MealEditSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50">
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => backOrHome(router)}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <ChevronLeft size={24} color={colors.neutral[800]} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <MealEditor meal={query.data} />;
}
