import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
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
import { pickImage } from "@/lib/media/image-picker";
import { Info } from "lucide-react-native";
import { GOALS_DISCLAIMER_TEXT } from "@fitbrother/shared";
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
import { useCreateMealPhoto } from "@/lib/hooks/useCreateMealPhoto";
import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { uploadMealAudio, uploadMealPhoto } from "@/lib/storage";
import type { AudioExtension } from "@/lib/audio/recorder";
import { Card } from "@/components/Card";
import { AnalisesPanel } from "@/components/domain/AnalisesPanel";
import { FeedTabContent } from "@/components/domain/FeedTabContent";
import { HomeHeader, greetingFor, type HomeTab } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { useStreak } from "@/lib/hooks/useStreak";

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
  const createMealPhoto = useCreateMealPhoto();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;
  const summaryQuery = useDailySummary(day);
  useDailySummaryRealtime(userId, day);
  useMealsRealtime(userId, day);
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HomeTab>("home");
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { data: streakView } = useStreak();
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

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
    async (params: { fileUri: string; durationMs: number; ext: AudioExtension }) => {
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

  const handlePhotoPress = useCallback(async () => {
    if (!userId) return;
    setBanner(null);
    try {
      const uri = await pickImage();
      if (!uri) return;
      const client_meal_id = newClientMealId();
      const { path } = await uploadMealPhoto({
        userId,
        mealId: client_meal_id,
        fileUri: uri,
      });
      createMealPhoto.mutate(
        {
          client_meal_id,
          image_path: path,
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[handlePhotoPress] photo error:", err);
      setBanner("network");
    }
  }, [createMealPhoto, day, userId]);

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

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}

        <View className="sticky top-0 z-10 bg-neutral-50 px-6 pb-4 pt-5">
          <Card
            variant="elevated"
            className="mx-auto w-full max-w-[1120px] flex-row items-center justify-between"
          >
            <View>
              <Text className="text-[13px] font-sans text-neutral-500">
                {greetingFor(new Date())}, {firstName}
              </Text>
              <Text className="mt-0.5 text-[28px] font-display-bold text-neutral-800">Hoje</Text>
            </View>
            {!profile.soft_mode && streakView && (
              <StreakCounter
                current={streakView.streak.current_streak}
                atRisk={streakView.atRisk}
              />
            )}
          </Card>
        </View>

        <View className="mx-auto w-full max-w-[1120px] flex-1 flex-row items-start gap-8">
          <View className="sticky top-[124px] w-[320px] shrink-0 gap-5 xl:w-[400px]">
            <Card variant="elevated">
              <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
            </Card>
            <GoalsDisclaimer />
          </View>

          <View className="flex-1">
            <View className="mb-4 flex-row items-baseline justify-between gap-4">
              <Text className="text-2xl font-display-bold text-neutral-800">Refeições</Text>
              <Text
                className="text-[13px] text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {items.length} de hoje
              </Text>
            </View>
            {mealsQuery.isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : items.length === 0 ? (
              <Card variant="flat">
                <EmptyMealsState />
              </Card>
            ) : (
              <Animated.FlatList
                data={items}
                keyExtractor={(m) => (m as OptimisticMeal).id}
                renderItem={renderItem as never}
                contentContainerStyle={{ paddingBottom: 180 }}
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
          </View>
        </View>

        <View className="sticky bottom-0 z-10 bg-neutral-50 px-6 pb-3 pt-4">
          <View className="mx-auto w-full max-w-[1120px]">
            <MealComposer
              onSend={handleSend}
              onAudioReady={handleAudioReady}
              onPhotoPress={handlePhotoPress}
              onScanPress={() => router.push("/(app)/scan" as never)}
              disabled={banner === "quota_exceeded"}
              processing={
                createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
              }
            />
            <Text className="mt-2.5 text-center text-[12.5px] text-neutral-400">
              Escreva, dite ou fotografe — a IA calcula os macros.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View className="px-4 pb-2">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text className="text-xl font-display-bold text-neutral-800">Refeições</Text>
        <Text className="text-[13px] text-neutral-500" style={{ fontVariant: ["tabular-nums"] }}>
          {items.length} de hoje
        </Text>
      </View>
    </View>
  );

  const macroPanel = (
    <View className="gap-2 px-4 pb-2 pt-3">
      <Card variant="elevated" className="relative">
        <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
        <Pressable
          onPress={() => setDisclaimerOpen((v) => !v)}
          accessibilityLabel={
            disclaimerOpen ? "Esconder aviso sobre as metas" : "Sobre estas metas"
          }
          accessibilityRole="button"
          hitSlop={8}
          className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full"
        >
          <Info size={16} color={colors.neutral[400]} />
        </Pressable>
      </Card>
      {disclaimerOpen && (
        <View className="flex-row items-start gap-2 rounded-2xl bg-neutral-100 p-3">
          <Info size={16} color={colors.neutral[500]} />
          <Text className="flex-1 text-xs font-sans text-neutral-600">{GOALS_DISCLAIMER_TEXT}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <HomeHeader softMode={profile.soft_mode} activeTab={activeTab} onChangeTab={setActiveTab} />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      {activeTab === "home" && (
        <>
          {macroPanel}
          {listHeader}
          {mealsQuery.isLoading ? (
            <Pressable className="flex-1" onPress={Keyboard.dismiss} />
          ) : items.length === 0 ? (
            <Pressable className="flex-1" onPress={Keyboard.dismiss}>
              <Card variant="flat" className="mx-4">
                <EmptyMealsState />
              </Card>
            </Pressable>
          ) : (
            <Animated.FlatList
              data={items}
              keyExtractor={(m) => (m as OptimisticMeal).id}
              renderItem={renderItem as never}
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
        </>
      )}
      {activeTab === "feed" && <FeedTabContent />}
      {activeTab === "analises" && <AnalisesPanel />}
      {/* Composer sits over the list. We drive its position from
          useAnimatedKeyboard instead of KeyboardAvoidingView because absolute
          children inside KAV don't observe the padding it adds. */}
      <Animated.View
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, composerStyle]}
      >
        <View className="bg-neutral-50 pb-2 pt-3">
          <MealComposer
            onSend={handleSend}
            onAudioReady={handleAudioReady}
            onPhotoPress={handlePhotoPress}
            onScanPress={() => router.push("/(app)/scan" as never)}
            disabled={banner === "quota_exceeded"}
            processing={
              createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
            }
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
