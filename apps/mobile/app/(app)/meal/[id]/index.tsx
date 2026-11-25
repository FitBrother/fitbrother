import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
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

function ReviewBanner({ meal, dirty }: { meal: MealResponse; dirty: boolean }) {
  const profile = useProfile();
  const confirm = useConfirmMeal();
  const toast = useToast();
  const day = nutritionalDay(new Date(meal.consumed_at), profile);

  const handleConfirm = () => {
    confirm.mutate(
      { id: meal.id, day },
      { onError: () => toast({ variant: "error", message: "Não foi possível confirmar" }) },
    );
  };

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
        accessibilityRole="button"
        onPress={handleConfirm}
        disabled={dirty}
        loading={confirm.isPending}
        className="w-full"
      />
      {dirty ? (
        <Text className="font-sans text-xs text-warning-700">
          Salve as alterações para confirmar.
        </Text>
      ) : null}
    </View>
  );
}

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 px-6">
        <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  const meal = query.data;
  return (
    <MealEditor
      meal={meal}
      banner={
        meal.review_required ? ({ dirty }) => <ReviewBanner meal={meal} dirty={dirty} /> : undefined
      }
    />
  );
}
