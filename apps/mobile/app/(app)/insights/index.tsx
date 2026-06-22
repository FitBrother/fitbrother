import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { Insight } from "@fitbrother/shared";
import { InsightCard } from "@/components/domain/InsightCard";
import { useInsights } from "@/lib/hooks/useInsights";
import { colors } from "@/lib/colors";

const PERIODS = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
] as const;

export default function InsightsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const q = useInsights(period);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Análises</Text>
      </View>

      <View className="mx-4 mb-2 flex-row rounded-full bg-neutral-100 p-1">
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            accessibilityRole="button"
            accessibilityLabel={p.label}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-full ${period === p.key ? "bg-white" : ""}`}
          >
            <Text
              className={
                period === p.key
                  ? "font-sans-semibold text-neutral-800"
                  : "font-sans text-neutral-500"
              }
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(i: Insight) => i.id}
          contentContainerClassName="gap-4 px-4 pb-8"
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          ListEmptyComponent={
            <View className="mt-16 items-center px-6">
              <Text className="text-center text-lg font-sans-bold text-neutral-800">
                Sem análises ainda
              </Text>
              <Text className="mt-2 text-center text-sm font-sans text-neutral-500">
                Registre alguns dias pra desbloquear sua análise deste período.
              </Text>
            </View>
          }
          renderItem={({ item }) => <InsightCard insight={item} />}
        />
      )}
    </SafeAreaView>
  );
}
