import { useQueryClient } from "@tanstack/react-query";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  BarChart3,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Users,
} from "lucide-react-native";
import { useState, type ComponentType, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDialog } from "@/lib/dialog/dialog-context";
import { EmailConfirmationBanner } from "@/components/domain/EmailConfirmationBanner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { InstallPrompt } from "@/components/domain/InstallPrompt";
import { ProfileSkeleton } from "@/components/domain/ProfileSkeleton";
import { TourTarget } from "@/components/tour/TourTarget";
import { patchAccountAvatar } from "@/lib/api/account";
import { profileInitials } from "@/lib/account-utils";
import { colors } from "@/lib/colors";
import { accountProfileKey, useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { avatarUrlKey, resolveAvatarUrl, useAvatarUrl } from "@/lib/hooks/useAvatarUrl";
import { backOrHome } from "@/lib/navigation";
import { useProfileActions } from "@/lib/profile/profile-context";
import { shadows } from "@/lib/shadows";
import { reloadApp } from "@/lib/reload-app";
import { uploadAvatar } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

type Icon = ComponentType<{ size?: number; color?: string }>;

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dialog = useDialog();
  const account = useAccountProfile();
  const { update } = useProfileActions();
  // Mesma query de `HomeHeader` (chave = caminho do avatar): a foto assinada
  // uma vez fica em cache pro app inteiro — sem isso, cada tela reassinava a
  // URL do zero, e ir e voltar entre Perfil e Home recarregava a foto toda
  // vez, mesmo sem ela ter mudado.
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarModal, setAvatarModal] = useState<"actions" | "confirm-remove" | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const profile = account.data?.profile;
  const user = account.data?.user;
  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  async function chooseAvatar() {
    if (!user) return;
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        await dialog.alert({
          title: "Permissão necessária",
          description: "Autorize o acesso às fotos para trocar seu avatar.",
        });
        return;
      }
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
      // 512px é mais que suficiente pro maior uso (perfil, 96pt @3x) — sem
      // isso a foto original (câmera moderna, alguns megapixels) ia inteira
      // pro Storage e voltava assim em toda revalidação, pesando download e
      // decode do <Image> pra caber num círculo de 44-96pt.
      const resized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], {
        compress: 0.82,
        format: SaveFormat.JPEG,
      });
      const { path } = await uploadAvatar({ userId: user.id, fileUri: resized.uri });
      await patchAccountAvatar(path);
      update({ avatar_url: path });
      await queryClient.invalidateQueries({ queryKey: accountProfileKey });
      // O caminho do arquivo não muda entre uploads (upsert no mesmo path) —
      // só a URL assinada muda (token novo). Empurra ela direto no cache
      // compartilhado: invalidar a query sozinha não bastaria, porque a
      // chave (o path) continua igual e nada disparava um refetch.
      queryClient.setQueryData(avatarUrlKey(path), await resolveAvatarUrl(path));
      toast({ variant: "success", message: "Foto atualizada" });
    } catch {
      toast({ variant: "error", message: "Não foi possível atualizar a foto" });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarModal(null);
    setAvatarBusy(true);
    try {
      await patchAccountAvatar(null);
      update({ avatar_url: null });
      await queryClient.invalidateQueries({ queryKey: accountProfileKey });
      toast({ variant: "success", message: "Foto removida" });
    } catch {
      toast({ variant: "error", message: "Não foi possível remover a foto" });
    } finally {
      setAvatarBusy(false);
    }
  }

  if (account.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas md:mx-auto md:w-full md:max-w-[640px]">
        <ProfileSkeleton />
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
    <SafeAreaView className="flex-1 bg-canvas md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => backOrHome(router)}
          accessibilityLabel="Voltar"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[900]} />
        </Pressable>
        <Text className="ml-2 font-display-bold text-xl text-neutral-900">Perfil</Text>
      </View>
      <PullToRefresh onRefresh={reloadApp}>
        <ScrollView contentContainerClassName="gap-6 px-5 pb-10 pt-3">
          <EmailConfirmationBanner />
          <TourTarget id="profile-shortcut-card">
            <InstallPrompt />
          </TourTarget>
          <View className="items-center">
            <Pressable
              onPress={() => setAvatarModal("actions")}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Opções da foto do perfil"
              className="relative h-24 w-24"
            >
              <Avatar
                uri={avatarUrl ?? null}
                loading={avatarUrl === undefined || avatarBusy}
                initials={initials}
                size={96}
                accessibilityLabel="Foto do perfil"
              />
              <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-primary-400">
                <Camera size={18} color={colors.neutral[50]} />
              </View>
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
            {/* Esta tela é a sua CONTA (configurações, atalhos); `/users/:id` é
                como você aparece para os outros, com seus posts. São coisas
                diferentes e por isso o rótulo diz "público" — sem essa palavra,
                dois itens chamados "Perfil" levando a telas distintas é que
                confundiriam. */}
            <MenuItem
              icon={UserRound}
              label="Ver perfil público"
              onPress={() => router.push(`/(app)/users/${user.id}` as never)}
            />
            <TourTarget id="profile-goals">
              <MenuItem
                icon={Target}
                label="Metas e macros"
                onPress={() => router.push("/goals" as never)}
              />
            </TourTarget>
            <MenuItem
              icon={Clock3}
              label="Histórico"
              onPress={() => router.push("/(app)/history")}
            />
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
            <MenuItem
              icon={Info}
              label="Sobre"
              onPress={() => router.push("/about" as never)}
              last
            />
          </MenuSection>
          <Pressable
            onPress={() => setLogoutConfirm(true)}
            accessibilityRole="button"
            className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white"
          >
            <LogOut size={19} color={colors.danger[600]} />
            <Text className="font-sans-semibold text-base text-danger-600">Sair</Text>
          </Pressable>
        </ScrollView>
      </PullToRefresh>
      <Modal
        visible={avatarModal === "actions"}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModal(null)}
      >
        <View className="flex-1 items-center justify-center px-6">
          <Pressable
            onPress={() => setAvatarModal(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar opções da foto do perfil"
            className="absolute inset-0 bg-black/40"
          />
          <View style={shadows.card} className="w-full max-w-sm rounded-2xl bg-white p-5">
            <Text className="text-center font-display-bold text-xl text-neutral-900">
              Foto do perfil
            </Text>
            <View className="mt-5 gap-3">
              <Pressable
                onPress={() => {
                  setAvatarModal(null);
                  void chooseAvatar();
                }}
                accessibilityRole="button"
                accessibilityLabel="Alterar foto do perfil"
                className="min-h-[52px] items-center justify-center rounded-[26px] bg-primary-400"
              >
                <Text className="font-sans-semibold text-neutral-900">Alterar foto</Text>
              </Pressable>
              {profile.avatar_url ? (
                <Pressable
                  onPress={() => setAvatarModal("confirm-remove")}
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto do perfil"
                  className="min-h-[52px] items-center justify-center rounded-[26px] border border-danger-200 bg-danger-50"
                >
                  <Text className="font-sans-semibold text-danger-600">Remover foto</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setAvatarModal(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                className="min-h-[52px] items-center justify-center rounded-[26px] bg-neutral-100"
              >
                <Text className="font-sans-semibold text-neutral-700">Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancelar volta para a folha de opções, não fecha tudo: quem chegou
          aqui veio de lá e provavelmente ainda quer trocar a foto. */}
      <ConfirmDialog
        visible={avatarModal === "confirm-remove"}
        title="Remover foto do perfil?"
        description="Suas iniciais serão exibidas no lugar da foto."
        confirmLabel="Remover"
        destructive
        onConfirm={() => void removeAvatar()}
        onCancel={() => setAvatarModal("actions")}
      />

      <ConfirmDialog
        visible={logoutConfirm}
        title="Sair da conta?"
        description="Seus dados continuam salvos. Você vai precisar entrar de novo para registrar refeições."
        confirmLabel="Sair"
        destructive
        onConfirm={() => {
          setLogoutConfirm(false);
          void supabase.auth.signOut();
        }}
        onCancel={() => setLogoutConfirm(false)}
      />
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
