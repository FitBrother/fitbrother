import { Pressable, ScrollView, Text, View } from "react-native";
import { Calendar, Rss, Search, Sparkles, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({ name, softMode = false }: { name: string; softMode?: boolean }) {
  const router = useRouter();
  const firstName = name.split(" ")[0] ?? name;
  const { data: streakView } = useStreak();
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <View className="min-w-[88px] shrink">
        <Text numberOfLines={1} className="text-sm font-sans text-neutral-500">
          {greetingFor(new Date())},
        </Text>
        <Text numberOfLines={1} className="text-2xl font-display-bold text-neutral-800">
          {firstName}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2"
        className="ml-2 shrink-0 md:hidden"
      >
        {!softMode && streakView ? (
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        ) : null}
        <Pressable
          onPress={() => router.push("/(app)/history")}
          accessibilityLabel="Histórico"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Calendar size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/feed" as never)}
          accessibilityLabel="Feed"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Rss size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/insights" as never)}
          accessibilityLabel="Análises"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Sparkles size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/users/search" as never)}
          accessibilityLabel="Buscar pessoas"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Search size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/friends")}
          accessibilityLabel="Amigos"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Users size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <User size={22} color={colors.neutral[800]} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
