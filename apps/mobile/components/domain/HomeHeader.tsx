import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Calendar, Rss, Sparkles, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";

// Feed e Análises já viram ícones próprios na faixa da direita — o menu
// carrega só os destinos sem ícone dedicado. "Buscar pessoas" saiu daqui e
// passou a viver dentro da aba Amigos.
const MENU_ITEMS = [
  { href: "/(app)/history" as const, label: "Histórico", Icon: Calendar },
  { href: "/(app)/profile" as const, label: "Perfil", Icon: User },
  { href: "/(app)/friends" as const, label: "Amigos", Icon: Users },
];

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({
  name,
  softMode = false,
  avatarUrl,
}: {
  name: string;
  softMode?: boolean;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const { data: streakView } = useStreak();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3 md:hidden">
      <View className="min-w-[20px]">
        {!softMode && streakView ? (
          <StreakCounter
            current={streakView.streak.current_streak}
            atRisk={streakView.atRisk}
            size={20}
          />
        ) : null}
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Menu"
          accessibilityRole="button"
        >
          <Avatar avatarPath={avatarUrl} fullName={name} size={48} />
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
          onPress={() => router.push("/(app)/feed" as never)}
          accessibilityLabel="Feed"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Rss size={22} color={colors.neutral[800]} />
        </Pressable>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          onPress={() => setMenuOpen(false)}
          accessibilityLabel="Fechar menu"
          accessibilityRole="button"
          className="flex-1 items-center justify-center bg-black/40 px-8"
        >
          <View
            style={shadows.card}
            className="w-full max-w-xs rounded-2xl bg-white py-2"
            onStartShouldSetResponder={() => true}
          >
            {MENU_ITEMS.map(({ href, label, Icon }) => (
              <Pressable
                key={href}
                onPress={() => {
                  setMenuOpen(false);
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
