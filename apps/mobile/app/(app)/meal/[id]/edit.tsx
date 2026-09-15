import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { EditMealModal } from "@/components/domain/EditMealModal";
import { MealEditSkeleton } from "@/components/domain/MealEditSkeleton";

export default function EditMealRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();

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
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  return (
    <EditMealModal
      meal={query.data}
      day={nutritionalDay(new Date(query.data.consumed_at), profile)}
    />
  );
}
