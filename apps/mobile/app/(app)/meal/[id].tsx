import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useConfirmMeal } from "@/lib/hooks/useConfirmMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useProfile();
  const confirm = useConfirmMeal();
  const remove = useDeleteMeal();

  const query = useQuery({
    queryKey: mealDetailKey(id ?? ""),
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });

  if (query.isLoading || !id) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </SafeAreaView>
    );
  }
  if (query.isError || !query.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 px-6">
        <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  const meal = query.data;
  const day = nutritionalDay(new Date(meal.consumed_at), profile);

  const handleConfirm = () => {
    confirm.mutate(
      { id: meal.id, day },
      {
        onError: () => Alert.alert("Não foi possível confirmar", "Tente novamente em instantes."),
      },
    );
  };

  const handleDelete = () => {
    Alert.alert("Excluir refeição?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          remove.mutate(
            { id: meal.id, day },
            {
              onSuccess: () => router.back(),
              onError: () =>
                Alert.alert("Não foi possível excluir", "Tente novamente em instantes."),
            },
          );
        },
      },
    ]);
  };

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
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">Refeição</Text>
        <Pressable
          onPress={handleDelete}
          disabled={remove.isPending}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={20} color={colors.danger[500]} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mx-4 mt-2 rounded-2xl bg-white p-4 shadow-sm">
          <Text style={NUM} className="text-3xl font-sans-extrabold text-neutral-800">
            {Math.round(meal.total_kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-2 text-sm font-sans text-neutral-500">
            {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C ·{" "}
            {Math.round(meal.total_fat_g)}g G
          </Text>
        </View>

        <Text className="ml-4 mt-5 text-xs font-sans-semibold uppercase text-neutral-500">
          Itens
        </Text>
        <View className="mx-4 mt-2 gap-2">
          {meal.items.map((item) => (
            <View key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <Text className="text-base font-sans-medium text-neutral-800">
                {item.description}
              </Text>
              <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
                {item.quantity} {item.unit} · {Math.round(item.kcal)} kcal
              </Text>
            </View>
          ))}
        </View>

        {meal.review_required && (
          <Pressable
            onPress={handleConfirm}
            disabled={confirm.isPending}
            accessibilityRole="button"
            accessibilityLabel="Confirmar refeição"
            className="mx-4 mt-6 min-h-[44px] items-center justify-center rounded-full bg-primary-400 px-6 py-3 active:bg-primary-500 disabled:opacity-60"
          >
            <Text className="text-base font-sans-semibold text-white">
              {confirm.isPending ? "Confirmando…" : "Confirmar"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
