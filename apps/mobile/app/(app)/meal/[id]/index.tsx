import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Download, Pencil, Share2, Sparkles, Trash2 } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useConfirmMeal } from "@/lib/hooks/useConfirmMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { useProfile } from "@/lib/profile/profile-context";
import { useDialog } from "@/lib/dialog/dialog-context";
import { useToast } from "@/lib/toast/toast-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { MealItemRowSwipeable } from "@/components/domain/MealItemRowSwipeable";

function toPatchItem(it: MealResponse["items"][number]) {
  return {
    id: it.id,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    kcal: it.kcal,
    protein_g: it.protein_g,
    carbs_g: it.carbs_g,
    fat_g: it.fat_g,
  };
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useProfile();
  const confirm = useConfirmMeal();
  const remove = useDeleteMeal();
  const dialog = useDialog();
  const toast = useToast();
  const query = useQuery({
    queryKey: mealDetailKey(id ?? ""),
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });
  // day depende do meal carregado; antes disso vai como "" (mutate só é
  // chamado depois que `meal` já existe).
  const day = query.data ? nutritionalDay(new Date(query.data.consumed_at), profile) : "";
  const update = useUpdateMeal(id ?? "", day);

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

  const handleConfirm = () => {
    confirm.mutate(
      { id: meal.id, day },
      { onError: () => toast({ variant: "error", message: "Não foi possível confirmar" }) },
    );
  };

  const excluirRefeicao = () => {
    remove.mutate(
      { id: meal.id, day },
      {
        onSuccess: () => router.back(),
        onError: () => toast({ variant: "error", message: "Não foi possível excluir" }),
      },
    );
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: "Excluir refeição?",
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) excluirRefeicao();
  };

  const handleRemoveItem = async (itemId: string) => {
    const remaining = meal.items.filter((it) => it.id !== itemId);
    if (remaining.length === 0) {
      // Cascade: remover o último item exclui a refeição.
      const ok = await dialog.confirm({
        title: "Excluir refeição?",
        description: "Esse era o último item. Remover vai excluir a refeição inteira.",
        confirmLabel: "Excluir",
        destructive: true,
      });
      if (ok) excluirRefeicao();
      return;
    }
    update.mutate(
      { items: remaining.map(toPatchItem) },
      { onError: () => toast({ variant: "error", message: "Não foi possível remover" }) },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-display-bold text-neutral-800">Refeição</Text>
        <Pressable
          onPress={() => router.push(`/(app)/share/meal/${meal.id}` as never)}
          accessibilityLabel="Exportar imagem"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Download size={20} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pathname: "/(app)/meal/[id]/edit" as any,
              params: { id: meal.id },
            })
          }
          accessibilityLabel="Editar refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Pencil size={20} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => void handleDelete()}
          disabled={remove.isPending}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={20} color={colors.danger[500]} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={shadows.card} className="mx-4 mt-2 rounded-[26px] bg-white p-4">
          <Text style={NUM} className="text-3xl font-display-bold text-neutral-800">
            {Math.round(meal.total_kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-2 text-sm font-sans text-neutral-500">
            {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C ·{" "}
            {Math.round(meal.total_fat_g)}g G
          </Text>
        </View>

        {meal.ai_feedback ? (
          <View className="mx-4 mt-3 flex-row items-start gap-2 rounded-2xl bg-primary-50 p-4">
            <Sparkles size={18} color={colors.primary[600]} />
            <Text className="flex-1 text-sm font-sans-medium text-primary-700">
              {meal.ai_feedback}
            </Text>
          </View>
        ) : null}

        <Text className="ml-4 mt-5 text-xs font-sans-semibold uppercase text-neutral-500">
          Itens
        </Text>
        <View className="mx-4 mt-2 gap-2">
          {meal.items.map((item) => (
            <MealItemRowSwipeable
              key={item.id}
              item={item}
              onDelete={() => void handleRemoveItem(item.id)}
            />
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

        {!meal.review_required && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/post/new" as never,
                params: { meal_id: meal.id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Compartilhar no feed"
            className="mx-4 mt-6 min-h-[52px] flex-row items-center justify-center rounded-full bg-primary-400 px-6 py-3 active:bg-primary-500"
          >
            <Share2 size={18} color={colors.neutral[50]} />
            <Text className="ml-2 text-base font-sans-semibold text-white">
              Compartilhar no feed
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
