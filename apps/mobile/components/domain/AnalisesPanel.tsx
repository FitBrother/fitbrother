import { useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import type { Insight } from "@fitbrother/shared";
import { InsightCard } from "@/components/domain/InsightCard";
import { SubTabs } from "@/components/domain/SubTabs";
import { PullToRefresh } from "@/components/PullToRefresh";
import { colors } from "@/lib/colors";
import { useInsights } from "@/lib/hooks/useInsights";
import { reloadApp } from "@/lib/reload-app";

const PERIODS = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
] as const;

/**
 * Conteúdo de "Análises" — extraído de app/(app)/insights/index.tsx pra ser
 * reaproveitado tanto na rota própria (desktop, via Sidebar) quanto na aba
 * "Análises" da Home no mobile.
 */
export function AnalisesPanel() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const q = useInsights(period);

  return (
    <View className="flex-1">
      <SubTabs tabs={PERIODS} active={period} onChange={setPeriod} />

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[400]} />
        </View>
      ) : (
        <PullToRefresh onRefresh={reloadApp}>
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
        </PullToRefresh>
      )}
    </View>
  );
}
