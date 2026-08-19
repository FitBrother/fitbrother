import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, UserCircle2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/colors";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";

const SHORTCUTS = [
  { label: "Conquistas", href: "/(app)/achievements" },
  { label: "Amigos", href: "/(app)/friends" },
  { label: "Análises", href: "/(app)/insights" },
  { label: "Histórico", href: "/(app)/history" },
  { label: "Configurações", href: "/(app)/settings" },
] as const;

function useAvatarSignedUrl(avatarPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("post-images")
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  return url;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data, isLoading } = useAccountProfile();
  const avatarUrl = useAvatarSignedUrl(data?.profile.avatar_url ?? null);

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
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Perfil</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-6">
          <View className="items-center gap-3 pt-4">
            <View className="h-28 w-28 items-center justify-center rounded-full border border-neutral-200 bg-white">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-28 w-28 rounded-full" />
              ) : (
                <UserCircle2 size={56} color={colors.neutral[400]} />
              )}
            </View>
            <View className="items-center">
              <Text className="text-xl font-display-bold text-neutral-800">
                {data.profile.full_name}
              </Text>
              {data.profile.username && (
                <Text className="font-sans text-neutral-500">@{data.profile.username}</Text>
              )}
            </View>
          </View>

          <View className="gap-3">
            {SHORTCUTS.map((s) => (
              <Pressable
                key={s.href}
                onPress={() => router.push(s.href as never)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <Text className="font-sans-medium text-base text-neutral-800">{s.label}</Text>
                <ChevronRight size={20} color={colors.neutral[400]} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => void supabase.auth.signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sair"
            className="min-h-[44px] items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="text-sm font-sans-semibold text-neutral-700">Sair</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
