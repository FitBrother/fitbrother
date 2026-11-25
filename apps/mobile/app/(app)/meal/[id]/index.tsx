import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft } from "lucide-react-native";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useConfirmMeal } from "@/lib/hooks/useConfirmMeal";
import { useProfile } from "@/lib/profile/profile-context";
import { useToast } from "@/lib/toast/toast-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { Button } from "@/components/Button";
import { MealEditor } from "@/components/domain/MealEditor";
import { MealEditSkeleton } from "@/components/domain/MealEditSkeleton";

const DIRTY_HINT = "Salve as alterações para confirmar.";

function ReviewBanner({ dirty, onConfirm }: { dirty: boolean; onConfirm: () => void }) {
  return (
    <View className="gap-3 rounded-2xl border-[1.5px] border-warning-500 bg-warning-50 p-4">
      <View className="flex-row items-start gap-2">
        <AlertTriangle size={20} color={colors.warning[700]} />
        <View className="flex-1 gap-1">
          <Text className="font-sans-bold text-base text-warning-700">Confira os itens</Text>
          <Text className="font-sans-medium text-sm text-warning-700">
            A IA não teve certeza de tudo. Ajuste o que precisar e confirme.
          </Text>
        </View>
      </View>
      <Button
        label="Confirmar refeição"
        accessibilityLabel="Confirmar refeição"
        accessibilityHint={dirty ? DIRTY_HINT : undefined}
        accessibilityRole="button"
        onPress={onConfirm}
        disabled={dirty}
        className="w-full"
      />
      {dirty ? <Text className="font-sans text-xs text-warning-700">{DIRTY_HINT}</Text> : null}
    </View>
  );
}

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useProfile();
  const confirm = useConfirmMeal();
  const toast = useToast();
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)"))}
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

  const meal = query.data;
  // The mutation lives here: the optimistic flip unmounts the banner, and per-call callbacks need a mounted observer.
  const handleConfirm = () => {
    confirm.mutate(
      { id: meal.id, day: nutritionalDay(new Date(meal.consumed_at), profile) },
      { onError: () => toast({ variant: "error", message: "Não foi possível confirmar" }) },
    );
  };

  return (
    <MealEditor
      meal={meal}
      banner={
        meal.review_required
          ? ({ dirty }) => <ReviewBanner dirty={dirty} onConfirm={handleConfirm} />
          : undefined
      }
    />
  );
}
