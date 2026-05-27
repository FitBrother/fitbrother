import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Lock, Trophy } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { useAchievements, useMyAchievements } from "@/lib/hooks/useAchievements";

export default function AchievementsScreen() {
  const router = useRouter();
  // Catálogo (M5.2) + desbloqueios do usuário, mesclados aqui: cada item do
  // catálogo recebe unlocked_at se estiver em user_achievements.
  const catalog = useAchievements();
  const mine = useMyAchievements();
  const isLoading = catalog.isLoading || mine.isLoading;

  const unlockedAt = new Map((mine.data ?? []).map((u) => [u.achievement_id, u.unlocked_at]));
  const items = [...(catalog.data ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ ...a, unlocked_at: unlockedAt.get(a.id) ?? null }));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Conquistas</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-3">
          {items.map((a) => {
            const unlocked = Boolean(a.unlocked_at);
            return (
              <View
                key={a.code}
                className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
                  unlocked ? "border-warning-400 bg-white" : "border-neutral-200 bg-neutral-100"
                }`}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    unlocked ? "bg-warning-100" : "bg-neutral-200"
                  }`}
                >
                  {unlocked ? (
                    <Trophy size={24} color={colors.warning[400]} />
                  ) : (
                    <Lock size={20} color={colors.neutral[400]} />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-sans-semibold text-base ${
                      unlocked ? "text-neutral-800" : "text-neutral-500"
                    }`}
                  >
                    {a.title}
                  </Text>
                  <Text className="font-sans text-sm text-neutral-500">{a.description}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
