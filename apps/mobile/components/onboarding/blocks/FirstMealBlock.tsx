import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MealComposer } from "@/components/domain/MealComposer";
import { newClientMealId, useCreateMealText } from "@/lib/hooks/useCreateMealText";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { uploadMealAudio } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function FirstMealBlock(_props: OnboardingBlockProps) {
  const [processing, setProcessing] = useState(false);
  const createText = useCreateMealText();
  const createAudio = useCreateMealAudio();
  const timezone = useOnboardingStore((s) => s.timezone);
  const day_start_hour = useOnboardingStore((s) => s.day_start_hour);
  const locale = useOnboardingStore((s) => s.locale);
  const reset = useOnboardingStore((s) => s.reset);
  const day = nutritionalToday({ timezone, day_start_hour });

  function finish() {
    reset();
    router.replace("/(app)" as never);
  }

  async function handleSend(text: string) {
    setProcessing(true);
    try {
      await createText.mutateAsync({
        client_meal_id: newClientMealId(),
        text,
        locale,
        day,
      });
      finish();
    } finally {
      setProcessing(false);
    }
  }

  async function handleAudioReady(params: {
    fileUri: string;
    durationMs: number;
    ext: "m4a" | "opus";
  }) {
    setProcessing(true);
    try {
      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      if (!userId) throw new Error("not_authenticated");

      const clientMealId = newClientMealId();
      const { path } = await uploadMealAudio({
        userId,
        mealId: clientMealId,
        fileUri: params.fileUri,
        ext: params.ext,
      });
      await createAudio.mutateAsync({
        client_meal_id: clientMealId,
        audio_path: path,
        duration_s: Math.max(1, Math.round(params.durationMs / 1000)),
        locale,
        day,
      });
      finish();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="gap-2 px-6 pt-4">
        <Text className="text-2xl font-display-bold text-neutral-800">
          Vamos registrar sua primeira refeição
        </Text>
        <Text className="text-base font-sans text-neutral-600">
          Texto ou áudio — do jeito que for mais fácil agora.
        </Text>
      </View>
      <View className="flex-1" />
      <MealComposer onSend={handleSend} onAudioReady={handleAudioReady} processing={processing} />
    </SafeAreaView>
  );
}
