import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Calendar, Rss, Sparkles, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";

const MENU_ITEMS = [
  { href: "/(app)/history" as const, label: "Histórico", Icon: Calendar },
  { href: "/(app)/profile" as const, label: "Perfil", Icon: User },
  { href: "/(app)/friends" as const, label: "Amigos", Icon: Users },
];

// Ícone de menu com só duas barras (em vez das 3 do Menu do lucide), pontas
// arredondadas pra combinar com o traço dos outros ícones lucide do app.
function HamburgerIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="8" x2="20" y2="8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="4" y1="16" x2="20" y2="16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({ softMode = false }: { softMode?: boolean }) {
  const router = useRouter();
  const { data: streakView } = useStreak();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3 md:hidden">
      {!softMode && streakView ? (
        <View style={shadows.floating} className="rounded-full bg-white px-2">
          <StreakCounter
            current={streakView.streak.current_streak}
            atRisk={streakView.atRisk}
            size={20}
          />
        </View>
      ) : (
        <View />
      )}

      <View
        style={shadows.floating}
        className="flex-row items-center gap-1 rounded-full bg-white p-1"
      >
        <Pressable
          onPress={() => router.push("/(app)/feed" as never)}
          accessibilityLabel="Feed"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Rss size={20} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/insights" as never)}
          accessibilityLabel="Análises"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Sparkles size={20} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Menu"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <HamburgerIcon size={20} color={colors.neutral[800]} />
        </Pressable>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          {/* Backdrop as a sibling, not a parent, of the menu card — a
              Pressable with accessibilityRole="button" renders as an actual
              <button> on web, and nesting the menu items' own <button>s
              inside it is invalid HTML that silently breaks click handling. */}
          <Pressable
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Fechar menu"
            accessibilityRole="button"
            pointerEvents="auto"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={shadows.card} className="w-full max-w-xs rounded-2xl bg-white py-2">
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
        </View>
      </Modal>
    </View>
  );
}
