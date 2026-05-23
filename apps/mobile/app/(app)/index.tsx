import { useCallback, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import {
  newClientMealId,
  useCreateMealText,
  type OptimisticMeal,
} from "@/lib/hooks/useCreateMealText";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { QuotaExceededError } from "@/lib/api/meals";
import { HomeHeader } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";

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
          } else if (err.message.startsWith("request_failed_5")) {
            setBanner("server_error");
          } else {
            setBanner("network");
          }
        },
      },
    );
  };

  const handleMic = () => {
    // M2.4 will replace this stub with the AudioRecorder. The haptic feedback
    // is fired inside MealComposer itself.
  };

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <HomeHeader name={profile.full_name} />
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
        {mealsQuery.isLoading ? (
          <View className="flex-1" />
        ) : items.length === 0 ? (
          <EmptyMealsState />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
        <MealComposer
          onSend={handleSend}
          onMicPress={handleMic}
          disabled={banner === "quota_exceeded"}
          processing={createMeal.isPending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
