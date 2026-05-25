import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MealResponse } from "@fitbrother/shared";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import { useDailySummary } from "@/lib/hooks/useDailySummary";
import { colors } from "@/lib/colors";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
import { MealCard } from "@/components/domain/MealCard";

function formatDayHeader(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HistoryDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const summaryQuery = useDailySummary(day ?? "");
  const mealsQuery = useMealsForDay(day ?? "");

  if (!day) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base font-sans text-neutral-600">Dia inválido.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">
          {formatDayHeader(day)}
        </Text>
      </View>
      {mealsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList<MealResponse>
          ListHeaderComponent={<TodaySummaryHeader summary={summaryQuery.data} />}
          data={mealsQuery.data ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View className="mx-4 mt-3">
              <MealCard
                meal={item}
                onPress={() =>
                  router.push({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pathname: "/(app)/meal/[id]" as any,
                    params: { id: item.id },
                  })
                }
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="mx-4 mt-8 items-center">
              <Text className="text-sm font-sans text-neutral-500">
                Nenhuma refeição neste dia.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
