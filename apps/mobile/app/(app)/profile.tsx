import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react-native";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { patchAccountAvatar } from "@/lib/api/account";
import { profileInitials } from "@/lib/account-utils";
import { colors } from "@/lib/colors";
import { accountProfileKey, useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { useProfileActions } from "@/lib/profile/profile-context";
import { getPostImageSignedUrl, uploadAvatar } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

type Icon = ComponentType<{ size?: number; color?: string }>;

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const account = useAccountProfile();
  const { update } = useProfileActions();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const profile = account.data?.profile;
  const user = account.data?.user;

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_url) {
      setAvatarUri(null);
      return;
    }
    void getPostImageSignedUrl(profile.avatar_url)
      .then((url) => active && setAvatarUri(url))
      .catch(() => active && setAvatarUri(null));
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  async function chooseAvatar() {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso às fotos para trocar seu avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarBusy(true);
    try {
      const { path } = await uploadAvatar({ userId: user.id, fileUri: result.assets[0].uri });
      await patchAccountAvatar(path);
      update({ avatar_url: path });
      await queryClient.invalidateQueries({ queryKey: accountProfileKey });
      setAvatarUri(await getPostImageSignedUrl(path));
      toast({ variant: "success", message: "Foto atualizada" });
    } catch {
      toast({ variant: "error", message: "Não foi possível atualizar a foto" });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await patchAccountAvatar(null);
      update({ avatar_url: null });
      setAvatarUri(null);
      await queryClient.invalidateQueries({ queryKey: accountProfileKey });
      toast({ variant: "success", message: "Foto removida" });
    } catch {
      toast({ variant: "error", message: "Não foi possível remover a foto" });
    } finally {
      setAvatarBusy(false);
    }
  }

  function avatarMenu() {
    Alert.alert("Foto do perfil", undefined, [
      { text: "Escolher foto", onPress: () => void chooseAvatar() },
      ...(profile?.avatar_url
        ? [
            {
              text: "Remover foto",
              style: "destructive" as const,
              onPress: () => void removeAvatar(),
            },
          ]
        : []),
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  if (account.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={colors.primary[400]} />
      </SafeAreaView>
    );
  }

  if (!profile || !user || account.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <Text className="font-display-bold text-xl text-neutral-900">
          Não foi possível abrir o perfil
        </Text>
        <Pressable
          onPress={() => account.refetch()}
          className="min-h-[44px] justify-center rounded-full bg-primary-400 px-6"
        >
          <Text className="font-sans-semibold text-neutral-900">Tentar novamente</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const initials = profileInitials(profile.full_name, user.email);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[900]} />
        </Pressable>
        <Text className="ml-2 font-display-bold text-xl text-neutral-900">Perfil</Text>
      </View>
      <ScrollView contentContainerClassName="gap-6 px-5 pb-10 pt-3">
        <View className="items-center">
          <Pressable
            onPress={avatarMenu}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel="Alterar foto do perfil"
            className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary-100"
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                className="h-24 w-24"
                accessibilityLabel="Foto do perfil"
              />
            ) : (
              <Text className="font-display-bold text-3xl text-primary-800">{initials}</Text>
            )}
            {avatarBusy ? (
              <View className="absolute inset-0 items-center justify-center bg-neutral-900/40">
                <ActivityIndicator color={colors.neutral[50]} />
              </View>
            ) : null}
          </Pressable>
          <Text className="mt-3 font-display-bold text-2xl text-neutral-900">
            {profile.full_name || "FitBrother"}
          </Text>
          {profile.username ? (
            <Text className="font-sans-medium text-sm text-primary-700">@{profile.username}</Text>
          ) : null}
          <Text className="mt-1 font-sans text-sm text-neutral-500">{user.email}</Text>
        </View>

        <MenuSection>
          <MenuItem icon={Clock3} label="Histórico" onPress={() => router.push("/(app)/history")} />
          <MenuItem
            icon={Award}
            label="Conquistas"
            onPress={() => router.push("/(app)/achievements")}
          />
          <MenuItem icon={Users} label="Amigos" onPress={() => router.push("/(app)/friends")} />
          <MenuItem
            icon={BarChart3}
            label="Insights"
            onPress={() => router.push("/(app)/insights")}
            last
          />
        </MenuSection>
        <MenuSection>
          <MenuItem
            icon={Settings}
            label="Configurações"
            onPress={() => router.push("/settings" as never)}
          />
          <MenuItem
            icon={ShieldCheck}
            label="Privacidade e dados"
            onPress={() => router.push("/privacy" as never)}
          />
          <MenuItem icon={Info} label="Sobre" onPress={() => router.push("/about" as never)} last />
        </MenuSection>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          accessibilityRole="button"
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white"
        >
          <LogOut size={19} color={colors.danger[600]} />
          <Text className="font-sans-semibold text-base text-danger-600">Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {children}
    </View>
  );
}

function MenuItem({
  icon: IconComponent,
  label,
  onPress,
  last = false,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`min-h-[56px] flex-row items-center px-4 active:bg-neutral-100 ${last ? "" : "border-b border-neutral-100"}`}
    >
      <IconComponent size={20} color={colors.primary[700]} />
      <Text className="ml-3 flex-1 font-sans-medium text-base text-neutral-900">{label}</Text>
      <ChevronRight size={19} color={colors.neutral[400]} />
    </Pressable>
  );
}
