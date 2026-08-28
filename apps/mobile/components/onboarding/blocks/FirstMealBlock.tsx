import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { MealComposer } from "@/components/domain/MealComposer";
import { newClientMealId, useCreateMealText } from "@/lib/hooks/useCreateMealText";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { uploadMealAudio } from "@/lib/storage";
import type { AudioExtension } from "@/lib/audio/recorder";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function FirstMealBlock({ chapter }: OnboardingBlockProps) {
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
    ext: AudioExtension;
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
    <OnboardingChapterShell
      chapter={chapter}
      title="Vamos registrar sua primeira refeição"
      subtitle="Texto ou áudio — do jeito que for mais fácil agora."
      showNav={false}
      onSkip={finish}
    >
      <View className="flex-1 justify-end">
        <MealComposer onSend={handleSend} onAudioReady={handleAudioReady} processing={processing} />
      </View>
    </OnboardingChapterShell>
  );
}
