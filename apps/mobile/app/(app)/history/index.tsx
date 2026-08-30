import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { DailySummary } from "@fitbrother/shared";
import { useDailySummaries } from "@/lib/hooks/useDailySummaries";
import { backOrHome } from "@/lib/navigation";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay, nutritionalToday } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { HistoryDayCard } from "@/components/domain/HistoryDayCard";
import { HistoryEmptyDayCard } from "@/components/domain/HistoryEmptyDayCard";
import { StreakCounter } from "@/components/domain/StreakCounter";

type DayEntry =
  | { type: "filled"; day: string; summary: DailySummary }
  | { type: "empty"; day: string };

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function expandRange(from: string, to: string, summaries: DailySummary[]): DayEntry[] {
  // Páginas com range variável (a última página pode ser menor que 7 dias se
  // o cutoff de criação da conta cortar no meio da semana).
  const byDay = new Map(summaries.map((s) => [s.day, s]));
  const out: DayEntry[] = [];
  let day = from;
  while (day <= to) {
    const summary = byDay.get(day);
    out.push(summary ? { type: "filled", day, summary } : { type: "empty", day });
    day = addDays(day, 1);
  }
  return out.reverse(); // newest first within page
}

export default function HistoryScreen() {
  const router = useRouter();
  const profile = useProfile();
  const today = nutritionalToday(profile);
  // Cutoff = dia nutricional da criação da conta. History nunca retrocede
  // além disso — sem cards motivacionais infinitos antes do signup.
  const cutoff = nutritionalDay(new Date(profile.created_at), profile);
  const query = useDailySummaries(today, cutoff);
  const { data: streakView } = useStreak();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  const entries = useMemo<DayEntry[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((page, pageIdx) => {
      const param = query.data.pageParams[pageIdx] as { from: string; to: string };
      return expandRange(param.from, param.to, page);
    });
  }, [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => backOrHome(router)}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-display-bold text-neutral-800">Histórico</Text>
        {!profile.soft_mode && streakView && (
          <View style={shadows.floating} className="rounded-full bg-white px-2">
            <StreakCounter
              current={streakView.streak.current_streak}
              atRisk={streakView.atRisk}
              size={20}
            />
          </View>
        )}
      </View>
      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[400]} />
        </View>
      ) : (
        <View className="mx-auto w-full flex-1 md:max-w-[1100px]">
          <FlatList
            key={numColumns}
            data={entries}
            numColumns={numColumns}
            keyExtractor={(e) => e.day}
            renderItem={({ item }) => (
              <View className="flex-1">
                {item.type === "filled" ? (
                  <HistoryDayCard summary={item.summary} softMode={profile.soft_mode} />
                ) : (
                  <HistoryEmptyDayCard day={item.day} />
                )}
              </View>
            )}
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
        </View>
      )}
    </SafeAreaView>
  );
}
