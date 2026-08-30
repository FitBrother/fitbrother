import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BarChart3, Home as HomeIcon, Rss } from "lucide-react-native";
import { colors } from "@/lib/colors";
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

      <View style={shadows.floating} className="flex-row rounded-full bg-white p-[3px]">
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <Pressable
              key={key}
              onPress={() => onChangeTab(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-70 ${
                active ? "bg-primary-400" : ""
              }`}
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
