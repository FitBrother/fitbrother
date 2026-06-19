import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { getMeal } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useCreatePost } from "@/lib/hooks/useCreatePost";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export default function NewPostScreen() {
  const router = useRouter();
  const { meal_id } = useLocalSearchParams<{ meal_id: string }>();
  const [caption, setCaption] = useState("");
  const create = useCreatePost();
  const mealQuery = useQuery({
    queryKey: mealDetailKey(meal_id ?? ""),
    queryFn: () => getMeal(meal_id!),
    enabled: Boolean(meal_id),
  });

  const meal = mealQuery.data;

  function publish() {
    if (!meal) return;
    create.mutate(
      { meal_id: meal.id, caption: caption.trim() || undefined },
      {
        onSuccess: () => router.replace("/(app)/feed" as never),
        onError: (err) => {
          Alert.alert("Não foi possível publicar", err.message);
        },
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Novo post</Text>
      </View>

      <View className="flex-1 gap-4 px-4 pt-4">
        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
          placeholder="Escreva uma legenda..."
          placeholderTextColor={colors.neutral[400]}
          className="min-h-[112px] rounded-2xl border border-neutral-200 bg-white p-4 text-base font-sans text-neutral-800"
          textAlignVertical="top"
        />

        <View className="rounded-2xl bg-white p-4">
          <Text className="font-sans-semibold text-neutral-800">Snapshot de macros</Text>
          {meal ? (
            <>
              <Text style={NUM} className="mt-3 text-3xl font-sans-extrabold text-neutral-800">
                {Math.round(meal.total_kcal)} kcal
              </Text>
              <Text style={NUM} className="mt-2 text-sm font-sans text-neutral-500">
                {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C ·{" "}
                {Math.round(meal.total_fat_g)}g G
              </Text>
            </>
          ) : (
            <Text className="mt-3 font-sans text-neutral-500">Carregando refeição...</Text>
          )}
        </View>
      </View>

      <View className="px-4 pb-4">
        <Button
          label="Publicar no feed"
          variant="primary"
          loading={create.isPending}
          disabled={!meal || create.isPending}
          onPress={publish}
        />
      </View>
    </SafeAreaView>
  );
}
