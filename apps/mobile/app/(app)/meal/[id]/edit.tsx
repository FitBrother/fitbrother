import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { EditMealModal } from "@/components/domain/EditMealModal";

export default function EditMealRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();

  const query = useQuery({
    queryKey: mealDetailKey(id ?? ""),
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });

  return (
    <>
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
      {query.isLoading || !query.data ? (
        <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
          {query.isError ? (
            <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary[400]} />
          )}
        </SafeAreaView>
      ) : (
        <EditMealModal
          meal={query.data}
          day={nutritionalDay(new Date(query.data.consumed_at), profile)}
        />
      )}
    </>
  );
}
