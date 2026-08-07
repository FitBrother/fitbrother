import { useCallback, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import * as Localization from "expo-localization";
import { useProfile } from "@/lib/profile/profile-context";
import { defaultConsumedAtForDay } from "@/lib/dateMath";
import { newClientMealId, useCreateMealText } from "@/lib/hooks/useCreateMealText";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { uploadMealAudio } from "@/lib/storage";
import type { AudioExtension } from "@/lib/audio/recorder";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { MealComposer } from "@/components/domain/MealComposer";
import { BackfillContextBar } from "@/components/domain/BackfillContextBar";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";

function detectLocale(): string {
  return Localization.getLocales()[0]?.languageTag ?? "pt-BR";
}

function formatDayHeader(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

export default function BackfillScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const profile = useProfile();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;
  const createMeal = useCreateMealText();
  const createMealAudio = useCreateMealAudio();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const [consumedAt, setConsumedAt] = useState(() =>
    day ? defaultConsumedAtForDay(day, profile) : new Date().toISOString(),
  );

  const handleSend = useCallback(
    (text: string) => {
      if (!day) return;
      setBanner(null);
      Keyboard.dismiss();
      createMeal.mutate(
        {
          client_meal_id: newClientMealId(),
          text,
          consumed_at: consumedAt,
          locale: detectLocale(),
          day,
        },
        {
          onSuccess: () => router.back(),
          onError: (err) => {
            if (err instanceof QuotaExceededError) {
              setBanner("quota_exceeded");
            } else if (err.message === "backfill_window_exceeded") {
              setBanner("backfill_window_exceeded");
            } else if (err.message === "request_timeout") {
              setBanner("offline");
            } else if ((getErrorStatus(err) ?? 0) >= 500) {
              setBanner("server_error");
            } else {
              setBanner("network");
            }
          },
        },
      );
    },
    [createMeal, consumedAt, day, router],
  );

  const handleAudioReady = useCallback(
    async (params: { fileUri: string; durationMs: number; ext: AudioExtension }) => {
      if (!userId || !day) return;
      setBanner(null);
      const client_meal_id = newClientMealId();
      const duration_s = Math.max(1, Math.round(params.durationMs / 1000));
      try {
        const { path } = await uploadMealAudio({
          userId,
          mealId: client_meal_id,
          fileUri: params.fileUri,
          ext: params.ext,
        });
        createMealAudio.mutate(
          {
            client_meal_id,
            audio_path: path,
            duration_s,
            consumed_at: consumedAt,
            locale: detectLocale(),
            day,
          },
          {
            onSuccess: () => router.back(),
            onError: (err) => {
              if (err instanceof QuotaExceededError) {
                setBanner("quota_exceeded");
              } else if (err.message === "backfill_window_exceeded") {
                setBanner("backfill_window_exceeded");
              } else if (err.message === "empty_transcription") {
                setBanner("network");
              } else if (err.message === "request_timeout") {
                setBanner("offline");
              } else if ((getErrorStatus(err) ?? 0) >= 500) {
                setBanner("server_error");
              } else {
                setBanner("network");
              }
            },
          },
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[backfill] upload failed:", err);
        setBanner("network");
      }
    },
    [createMealAudio, consumedAt, day, router, userId],
  );

  if (!day) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base font-sans text-neutral-600">Dia inválido.</Text>
      </View>
    );
  }

  const processing = createMeal.isPending || createMealAudio.isPending;

  return (
    <View className="bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <X size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-lg font-display-bold text-neutral-800">
          {formatDayHeader(day)}
        </Text>
      </View>
      <BackfillContextBar day={day} consumedAt={consumedAt} onChangeConsumedAt={setConsumedAt} />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      {/* Zera o bottom inset só pro composer — o sheet já está no fundo da
          tela, então a home indicator não precisa ser respeitada de novo. */}
      <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <MealComposer
          onSend={handleSend}
          onAudioReady={handleAudioReady}
          processing={processing}
          showBackdropFade={false}
        />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
