import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, CheckCircle2, UserCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useUsernameAvailable, USERNAME_RE } from "@/lib/hooks/useUsernameAvailable";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function Step9Username() {
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      setAvatarPreview(result.assets[0].uri);

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      if (!userId) throw new Error("not_authenticated");

      const file = await fetch(result.assets[0].uri).then((r) => r.blob());
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage.from("post-images").upload(path, file, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      setField("avatar_url", path);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Não foi possível salvar o avatar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <OnboardingStepShell
      step={8}
      total={ONBOARDING_STEPS}
      title="Escolha seu @username"
      subtitle="É assim que outras pessoas vão te encontrar no Fitbrother."
      onBack={() => router.replace("/(onboarding)/step-7" as never)}
      onNext={() => router.push("/(onboarding)/step-8" as never)}
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

        <Button
          label="Continuar"
          variant="primary"
          disabled={!canContinue}
          onPress={() => router.push("/(onboarding)/step-8" as never)}
        />
      </View>
    </OnboardingStepShell>
  );
}
