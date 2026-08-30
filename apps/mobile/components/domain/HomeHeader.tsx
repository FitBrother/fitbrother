import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { BarChart3, Home as HomeIcon, Rss } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { shadows } from "@/lib/shadows";
import { profileInitials } from "@/lib/account-utils";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useStreak } from "@/lib/hooks/useStreak";
import { useProfile } from "@/lib/profile/profile-context";
import { StreakCounter } from "@/components/domain/StreakCounter";

export type HomeTab = "home" | "feed" | "analises";

export const TABS: { key: HomeTab; label: string; Icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "feed", label: "Social", Icon: Rss },
  { key: "analises", label: "Análises", Icon: BarChart3 },
];

/** Padding interno da barra de abas, em px (equivale ao `p-[3px]`). */
const TAB_BAR_PADDING = 3;

/**
 * Largura de cada aba dentro da barra, descontado o padding das duas pontas.
 * É o passo do indicador deslizante — o deslocamento da aba i é `i * slot`.
 * Devolve 0 antes do primeiro onLayout, quando a largura ainda é desconhecida.
 */
export function tabSlotWidth(barWidth: number, count: number, padding: number): number {
  return Math.max(0, (barWidth - padding * 2) / count);
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({
  softMode = false,
  activeTab,
  onChangeTab,
}: {
  softMode?: boolean;
  activeTab: HomeTab;
  onChangeTab: (tab: HomeTab) => void;
}) {
  const router = useRouter();
  const { data: streakView } = useStreak();
  const profile = useProfile();
  const session = useAuthSession();
  const email = session.status === "signed_in" ? (session.session.user.email ?? null) : null;
  const initials = profileInitials(profile.full_name, email);

  // Indicador deslizante da aba ativa. A largura da barra só é conhecida depois
  // do layout, então o indicador só é renderizado a partir daí.
  const [barWidth, setBarWidth] = useState(0);
  const slot = tabSlotWidth(barWidth, TABS.length, TAB_BAR_PADDING);
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab),
  );
  const indicatorX = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const destino = activeIndex * slot;
    indicatorX.value = reducedMotion
      ? destino
      : withTiming(destino, {
          duration: Motion.duration.base,
          easing: Motion.easing.standard,
        });
  }, [activeIndex, slot, indicatorX, reducedMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View className="gap-2 px-4 pt-2 pb-1 md:hidden">
      <View className="flex-row items-center justify-between">
        {!softMode && streakView ? (
          <Pressable
            onPress={() => router.push("/(app)/history" as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver histórico de ofensivas"
            style={shadows.floating}
            className="rounded-full bg-white px-2 active:opacity-70"
          >
            <StreakCounter
              current={streakView.streak.current_streak}
              atRisk={streakView.atRisk}
              size={20}
            />
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          onPress={() => router.push("/(app)/profile" as never)}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <View
            style={shadows.floating}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary-100"
          >
            <Text className="font-sans-bold text-sm text-primary-800">{initials}</Text>
          </View>
        </Pressable>
      </View>

      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={shadows.floating}
        className="flex-row rounded-full bg-white p-[3px]"
      >
        {/* Estilo inline: o NativeWind não processa className em componentes
            do Reanimated. */}
        {slot > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: TAB_BAR_PADDING,
                bottom: TAB_BAR_PADDING,
                left: TAB_BAR_PADDING,
                width: slot,
                borderRadius: 9999,
                backgroundColor: colors.primary[400],
              },
              indicatorStyle,
            ]}
          />
        )}
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <Pressable
              key={key}
              onPress={() => onChangeTab(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-70"
            >
              <Icon size={15} color={active ? colors.neutral[900] : colors.neutral[400]} />
              <Text
                className={
                  active
                    ? "font-sans-bold text-xs text-neutral-900"
                    : "font-sans-medium text-xs text-neutral-400"
                }
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
