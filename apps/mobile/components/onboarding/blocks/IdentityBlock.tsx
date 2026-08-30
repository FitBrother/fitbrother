import { Camera, CheckCircle2, UserCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { useUsernameAvailable, USERNAME_RE } from "@/lib/hooks/useUsernameAvailable";
import { pickImage } from "@/lib/media/image-picker";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function IdentityBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const username = useOnboardingStore((s) => s.username);
  const avatarUrl = useOnboardingStore((s) => s.avatar_url);
  const setField = useOnboardingStore((s) => s.setField);
  const [touched, setTouched] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const normalized = username.trim().toLowerCase();
  const formatOk = USERNAME_RE.test(normalized);
  const { data: available, isFetching } = useUsernameAvailable(normalized);
  const canContinue = formatOk && available === true;

  async function handleAvatar() {
    setUploading(true);
    setAvatarError(null);
    try {
      const uri = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!uri) return;
      setAvatarPreview(uri);

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      if (!userId) throw new Error("not_authenticated");

      const file = await fetch(uri).then((r) => r.blob());
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage.from("post-images").upload(path, file, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      setField("avatar_url", path);
    } catch {
      setAvatarError("Não foi possível salvar o avatar. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Escolha seu @username"
      subtitle="É assim que outras pessoas vão te encontrar no Fitbrother."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canContinue}
    >
      <View className="gap-6">
        <View className="items-center gap-3">
          <Pressable
            onPress={handleAvatar}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Escolher avatar"
            className="min-h-[112px] min-w-[112px] items-center justify-center rounded-full border border-neutral-200 bg-white"
          >
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} className="h-28 w-28 rounded-full" />
            ) : (
              <UserCircle2 size={56} color={colors.neutral[400]} />
            )}
            <View className="absolute bottom-1 right-1 h-9 w-9 items-center justify-center rounded-full bg-primary-400">
              <Camera size={18} color={colors.neutral[50]} />
            </View>
          </Pressable>
          <Text className="text-sm font-sans text-neutral-500">
            {avatarUrl ? "Avatar salvo" : uploading ? "Enviando avatar..." : "Avatar opcional"}
          </Text>
          {avatarError ? (
            <Text className="text-center text-sm font-sans text-danger-500">{avatarError}</Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Input
            label="Username"
            value={username}
            onChangeText={(text) => {
              setField("username", text.toLowerCase());
              setTouched(true);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ex: maria.silva"
          />
          {touched && !formatOk ? (
            <Text className="text-sm font-sans text-danger-500">
              Use 3-20 caracteres: letras minúsculas, números, ponto ou _.
            </Text>
          ) : null}
          {formatOk && isFetching ? (
            <Text className="text-sm font-sans text-neutral-500">Verificando...</Text>
          ) : null}
          {formatOk && !isFetching && available === false ? (
            <Text className="text-sm font-sans text-danger-500">Esse username já está em uso.</Text>
          ) : null}
          {formatOk && available === true ? (
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={colors.success[500]} />
              <Text className="text-sm font-sans text-success-500">Disponível</Text>
            </View>
          ) : null}
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
