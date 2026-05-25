import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { DailySummary } from "@fitbrother/shared";
import { useDailySummaries } from "@/lib/hooks/useDailySummaries";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { HistoryDayCard } from "@/components/domain/HistoryDayCard";
import { HistoryEmptyDayCard } from "@/components/domain/HistoryEmptyDayCard";

type DayEntry =
  | { type: "filled"; day: string; summary: DailySummary }
  | { type: "empty"; day: string };

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function expandWeek(from: string, summaries: DailySummary[]): DayEntry[] {
  const byDay = new Map(summaries.map((s) => [s.day, s]));
  const out: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    const summary = byDay.get(day);
    out.push(summary ? { type: "filled", day, summary } : { type: "empty", day });
  }
  return out.reverse(); // newest first within week
}

export default function HistoryScreen() {
  const router = useRouter();
  const profile = useProfile();
  const today = nutritionalToday(profile);
  const query = useDailySummaries(today);

  const entries = useMemo<DayEntry[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((page, pageIdx) => {
      const param = query.data.pageParams[pageIdx] as { from: string; to: string };
      return expandWeek(param.from, page);
    });
  }, [query.data]);

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
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">Histórico</Text>
      </View>
      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.day}
          renderItem={({ item }) =>
            item.type === "filled" ? (
              <HistoryDayCard summary={item.summary} />
            ) : (
              <HistoryEmptyDayCard day={item.day} />
            )
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
