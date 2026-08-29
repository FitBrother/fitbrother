import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Calendar, Rss, Search, Sparkles, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import logoHorizontal from "@/assets/brand/logo-horizontal-menta.png";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";

const MENU_ITEMS = [
  { href: "/(app)/history" as const, label: "Histórico", Icon: Calendar },
  { href: "/(app)/profile" as const, label: "Perfil", Icon: User },
  { href: "/(app)/feed" as const, label: "Feed", Icon: Rss },
  { href: "/(app)/insights" as const, label: "Análises", Icon: Sparkles },
  { href: "/(app)/users/search" as const, label: "Buscar pessoas", Icon: Search },
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
    <View className="relative flex-row items-center justify-between px-4 pt-2 pb-3 md:hidden">
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
        >
          <Avatar avatarPath={avatarUrl} fullName={name} size={48} />
        </Pressable>
        {!softMode && streakView ? (
          <StreakCounter
            current={streakView.streak.current_streak}
            atRisk={streakView.atRisk}
            size={20}
          />
        ) : null}
      </View>

      <View className="absolute inset-x-0 items-center" pointerEvents="none">
        <Image
          source={logoHorizontal}
          style={{ height: 20, width: 124 }}
          resizeMode="contain"
          accessibilityLabel="Fitbrother"
        />
      </View>

      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityLabel="Menu"
        accessibilityRole="button"
        className="h-12 w-12 items-center justify-center rounded-full"
      >
        <HamburgerIcon size={28} color={colors.neutral[800]} />
      </Pressable>

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
