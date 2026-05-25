import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, Pressable, RefreshControl } from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import { useDailySummary } from "@/lib/hooks/useDailySummary";
import { useDailySummaryRealtime } from "@/lib/hooks/useDailySummaryRealtime";
import { useMealsRealtime } from "@/lib/hooks/useMealsRealtime";
import {
  newClientMealId,
  useCreateMealText,
  type OptimisticMeal,
} from "@/lib/hooks/useCreateMealText";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { uploadMealAudio } from "@/lib/storage";
import { HomeHeader } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";

function detectLocale(): string {
  const tag = Localization.getLocales()[0]?.languageTag;
  return tag ?? "pt-BR";
}

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const day = nutritionalToday(profile);
  const mealsQuery = useMealsForDay(day);
  const createMeal = useCreateMealText();
  const createMealAudio = useCreateMealAudio();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;
  const summaryQuery = useDailySummary(day);
  useDailySummaryRealtime(userId, day);
  useMealsRealtime(userId, day);
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);

  const items = (mealsQuery.data ?? []) as OptimisticMeal[];

  const handleSend = (text: string) => {
    setBanner(null);
    createMeal.mutate(
      {
        client_meal_id: newClientMealId(),
        text,
        locale: detectLocale(),
        day,
      },
      {
        onError: (err) => {
          if (err instanceof QuotaExceededError) {
            setBanner("quota_exceeded");
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
  };

  const handleAudioReady = useCallback(
    async (params: { fileUri: string; durationMs: number; ext: "m4a" | "opus" }) => {
      if (!userId) return;
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
            locale: detectLocale(),
            day,
          },
          {
            onError: (err) => {
              // eslint-disable-next-line no-console
              console.warn("[handleAudioReady] mutation error:", err);
              if (err instanceof QuotaExceededError) {
                setBanner("quota_exceeded");
              } else if (err.message === "empty_transcription") {
                setBanner("network"); // re-use network banner copy "tente de novo"
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
        console.warn("[handleAudioReady] upload error:", err);
        setBanner("network");
      }
    },
    [createMealAudio, day, userId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMeal.mutate(
        { id, day },
        {
          onError: () => setBanner("network"),
        },
      );
    },
    [deleteMeal, day],
  );

  // Drive the composer's translateY off the keyboard events directly. iOS
  // sends `keyboardWillShow/Hide` BEFORE the animation begins and includes
  // the duration the system will use — we mirror it with withTiming for a
  // seamless follow. Android only fires `keyboardDid*` so we use a sensible
  // default duration.
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      keyboardHeight.value = withTiming(e.endCoordinates.height, {
        duration,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      keyboardHeight.value = withTiming(0, {
        duration,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeight.value }],
  }));

  const renderItem = useMemo(
    () =>
      function MealListItem({ item }: { item: OptimisticMeal }) {
        if (item.__status === "processing") return <MealCardSkeleton />;
        return (
          <MealCardSwipeable
            meal={item}
            onPress={() =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              router.push({ pathname: "/(app)/meal/[id]" as any, params: { id: item.id } })
            }
            onDelete={() => handleDelete(item.id)}
          />
        );
      },
    // `handleDelete` captures `day`; including it ensures renderItem is
    // recreated at day rollover — FlatList compares by data reference anyway.
    [router, handleDelete],
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <HomeHeader name={profile.full_name} />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      {mealsQuery.isLoading ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss} />
      ) : items.length === 0 ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss}>
          <TodaySummaryHeader summary={summaryQuery.data} />
          <EmptyMealsState />
        </Pressable>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(m) => (m as OptimisticMeal).id}
          renderItem={renderItem as never}
          ListHeaderComponent={<TodaySummaryHeader summary={summaryQuery.data} />}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          refreshControl={
            <RefreshControl
              refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
              onRefresh={() => {
                void mealsQuery.refetch();
                void summaryQuery.refetch();
              }}
              tintColor={colors.primary[400]}
            />
          }
        />
      )}
      {/* Composer sits over the list. We drive its position from
          useAnimatedKeyboard instead of KeyboardAvoidingView because absolute
          children inside KAV don't observe the padding it adds. */}
      <Animated.View
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, composerStyle]}
      >
        <MealComposer
          onSend={handleSend}
          onAudioReady={handleAudioReady}
          disabled={banner === "quota_exceeded"}
          processing={createMeal.isPending || createMealAudio.isPending}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
