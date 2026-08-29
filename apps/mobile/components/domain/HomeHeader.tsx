import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Calendar, MoreHorizontal, Rss, Search, Sparkles, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";

const MORE_MENU_ITEMS = [
  { href: "/(app)/feed" as const, label: "Feed", Icon: Rss },
  { href: "/(app)/insights" as const, label: "Análises", Icon: Sparkles },
  { href: "/(app)/users/search" as const, label: "Buscar pessoas", Icon: Search },
  { href: "/(app)/friends" as const, label: "Amigos", Icon: Users },
];

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({ name, softMode = false }: { name: string; softMode?: boolean }) {
  const router = useRouter();
  const firstName = name.split(" ")[0] ?? name;
  const { data: streakView } = useStreak();
  const [moreOpen, setMoreOpen] = useState(false);

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
        className="ml-2 min-w-0 flex-1 md:hidden"
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
          onPress={() => router.push("/(app)/profile")}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <User size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => setMoreOpen(true)}
          accessibilityLabel="Mais opções"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <MoreHorizontal size={22} color={colors.neutral[800]} />
        </Pressable>
      </ScrollView>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          onPress={() => setMoreOpen(false)}
          accessibilityLabel="Fechar menu"
          accessibilityRole="button"
          className="flex-1 items-center justify-center bg-black/40 px-8"
        >
          <View
            style={shadows.card}
            className="w-full max-w-xs rounded-2xl bg-white py-2"
            onStartShouldSetResponder={() => true}
          >
            {MORE_MENU_ITEMS.map(({ href, label, Icon }) => (
              <Pressable
                key={href}
                onPress={() => {
                  setMoreOpen(false);
                  router.push(href as never);
                }}
                accessibilityLabel={label}
                accessibilityRole="button"
                className="min-h-[44px] flex-row items-center gap-3 px-4 py-3 active:bg-neutral-50"
              >
                <Icon size={20} color={colors.neutral[700]} />
                <Text className="text-base font-sans-medium text-neutral-800">{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
