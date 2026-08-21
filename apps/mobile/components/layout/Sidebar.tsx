import { useRouter, usePathname } from "expo-router";
import { Calendar, Home as HomeIcon, Rss, Search, Sparkles, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { profileInitials } from "@/lib/account-utils";
import { colors } from "@/lib/colors";
import { useStreak } from "@/lib/hooks/useStreak";
import { useProfile } from "@/lib/profile/profile-context";

type NavItem = {
  label: string;
  href: string;
  icon: typeof HomeIcon;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Histórico", href: "/(app)/history", icon: Calendar },
  { label: "Feed", href: "/(app)/feed", icon: Rss },
  { label: "Análises", href: "/(app)/insights", icon: Sparkles },
  { label: "Buscar pessoas", href: "/(app)/users/search", icon: Search },
  { label: "Amigos", href: "/(app)/friends", icon: Users },
];

function isActive(pathname: string, href: string): boolean {
  const path = href.replace("/(app)", "") || "/";
  return pathname === path || (path !== "/" && pathname.startsWith(path));
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useProfile();
  const { data: streakView } = useStreak();

  return (
    <View className="hidden w-[248px] shrink-0 border-r border-neutral-200 bg-white p-4 md:flex">
      <Text className="mb-6 px-2 text-xl font-display-bold text-primary-400">Fitbrother</Text>

      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            className={`mb-1 min-h-[44px] flex-row items-center gap-3 rounded-xl px-3 ${
              active ? "bg-primary-50" : ""
            }`}
          >
            <Icon size={20} color={active ? colors.primary[600] : colors.neutral[600]} />
            <Text
              className={`font-sans-medium ${active ? "text-primary-600" : "text-neutral-700"}`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}

      <View className="flex-1" />

      {streakView ? (
        <View className="mb-3 px-2">
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push("/(app)/profile")}
        accessibilityRole="link"
        accessibilityLabel="Perfil"
        className="min-h-[44px] flex-row items-center gap-3 rounded-xl px-2"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-100">
          <Text className="text-xs font-sans-bold text-primary-700">
            {profileInitials(profile.full_name, null)}
          </Text>
        </View>
        <Text className="flex-1 font-sans-medium text-neutral-800" numberOfLines={1}>
          {profile.full_name}
        </Text>
      </Pressable>
    </View>
  );
}
