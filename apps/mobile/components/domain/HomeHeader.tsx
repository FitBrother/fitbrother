import { Pressable, Text, View } from "react-native";
import { Calendar, Rss, Search, User, Users } from "lucide-react-native";
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

export function HomeHeader({ name }: { name: string }) {
  const router = useRouter();
  const firstName = name.split(" ")[0] ?? name;
  const { data: streakView } = useStreak();
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <View className="flex-1">
        <Text className="text-sm font-sans text-neutral-500">{greetingFor(new Date())},</Text>
        <Text className="text-2xl font-sans-extrabold text-neutral-800">{firstName}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {streakView ? (
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
      </View>
    </View>
  );
}
