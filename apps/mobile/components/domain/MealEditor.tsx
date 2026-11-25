import { useMemo, useReducer, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Search, Sparkles, Trash2 } from "lucide-react-native";
import {
  PatchMealItemSchema,
  type FoodSuggestion,
  type Macros,
  type MealResponse,
  type PatchMealRequest,
  type Unit,
} from "@fitbrother/shared";
import { draftFromSavedItem, toPatchItem } from "@/lib/meal-item-draft";
import { editMealReducer, type EditMealAction } from "@/lib/edit-meal-reducer";
import { stepQuantity } from "@/lib/quantity-step";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useDiscardChangesGuard } from "@/lib/hooks/useDiscardChangesGuard";
import { useDialog } from "@/lib/dialog/dialog-context";
import { useToast } from "@/lib/toast/toast-context";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { MealEditorSaveBar } from "./MealEditorSaveBar";
import { MealItemRow } from "./MealItemRow";
import { MealItemSheet } from "./MealItemSheet";
import { MealMetaChips } from "./MealMetaChips";
import { MealShareActions } from "./MealShareActions";
import { MealSummaryCard } from "./MealSummaryCard";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      protein_g: acc.protein_g + it.protein_g,
      carbs_g: acc.carbs_g + it.carbs_g,
      fat_g: acc.fat_g + it.fat_g,
    }),
    ZERO,
  );
}

function draftSignature(m: MealResponse): string {
  return JSON.stringify([
    m.meal_type,
    m.consumed_at,
    m.items.map((it) => [
      it.id,
      it.food_id,
      it.description,
      it.quantity,
      it.unit,
      it.kcal,
      it.protein_g,
      it.carbs_g,
      it.fat_g,
    ]),
  ]);
}

function sameMinute(a: string, b: string): boolean {
  return Math.floor(new Date(a).getTime() / 60000) === Math.floor(new Date(b).getTime() / 60000);
}

type Props = {
  meal: MealResponse;
  banner?: (ctx: { dirty: boolean }) => React.ReactNode;
};

export function MealEditor({ meal, banner }: Props) {
  const router = useRouter();
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const toast = useToast();

  const [baseline, setBaseline] = useState(meal);
  const [server, setServer] = useState(meal);
  const [seenSignature, setSeenSignature] = useState(() => draftSignature(meal));
  const [state, dispatch] = useReducer(editMealReducer, {
    items: meal.items.map(draftFromSavedItem),
    dirty: false,
  });
  const [mealType, setMealType] = useState(meal.meal_type);
  const [consumedAt, setConsumedAt] = useState(meal.consumed_at);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());

  const typeChanged = mealType !== baseline.meal_type;
  const timeChanged = !sameMinute(consumedAt, baseline.consumed_at);
  const newDay = timeChanged ? nutritionalDay(new Date(consumedAt), profile) : undefined;
  const dirty = state.dirty || typeChanged || timeChanged;
  const day = nutritionalDay(new Date(baseline.consumed_at), profile);

  const resetTo = (m: MealResponse) => {
    setBaseline(m);
    setServer(m);
    dispatch({ type: "init", items: m.items.map(draftFromSavedItem) });
    setMealType(m.meal_type);
    setConsumedAt(m.consumed_at);
    setOpenIndex(null);
    setErrorIndexes(new Set());
  };

  // Adjust state during render when the server copy changes; a dirty draft is never overwritten.
  const propSignature = draftSignature(meal);
  if (propSignature !== seenSignature) {
    setSeenSignature(propSignature);
    if (propSignature !== draftSignature(server)) {
      if (dirty) setServer(meal);
      else resetTo(meal);
    }
  }

  const update = useUpdateMeal(meal.id, day, newDay);
  const remove = useDeleteMeal();
  const guard = useDiscardChangesGuard(dirty);

  const initialKcal = useMemo(() => sumMacros(baseline.items).kcal, [baseline.items]);
  const totals = useMemo(() => sumMacros(state.items), [state.items]);

  const openItem = openIndex === null ? null : (state.items[openIndex] ?? null);

  const dropErrorAt = (index: number) =>
    setErrorIndexes(
      (prev) =>
        new Set(
          Array.from(prev)
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i)),
        ),
    );

  const removeItem = (index: number) => {
    setOpenIndex(null);
    dropErrorAt(index);
    dispatch({ type: "remove_item", index });
  };

  const isEmptyDraft = openItem !== null && !openItem.id && openItem.description.trim() === "";

  const discardDraft = (index: number) => {
    setOpenIndex(null);
    dropErrorAt(index);
    dispatch({ type: "discard_draft", index });
  };

  const closeSheet = () => {
    if (openIndex !== null && isEmptyDraft) {
      discardDraft(openIndex);
      return;
    }
    setOpenIndex(null);
  };

  const addItem = () => {
    setOpenIndex(state.items.length);
    dispatch({ type: "add_item" });
  };

  const deleteMeal = async (description: string) => {
    const ok = await dialog.confirm({
      title: "Excluir refeição?",
      description,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(
      { id: meal.id, day },
      {
        onSuccess: () => {
          guard.allowLeave();
          router.back();
        },
        onError: () => toast({ variant: "error", message: "Não foi possível excluir" }),
      },
    );
  };

  const handleSave = async () => {
    if (state.items.length === 0) {
      await deleteMeal("Você removeu todos os itens. A refeição inteira será excluída.");
      return;
    }

    const errors = new Set<number>();
    state.items.forEach((it, i) => {
      if (!PatchMealItemSchema.safeParse(toPatchItem(it)).success) errors.add(i);
    });
    if (errors.size > 0) {
      setErrorIndexes(errors);
      const list = Array.from(errors)
        .map((i) => i + 1)
        .join(", ");
      // Toast, not a dialog: a dialog would cover the rows it points to.
      toast({
        variant: "error",
        message: `Ite${errors.size > 1 ? "ns" : "m"} ${list} com campos inválidos`,
      });
      return;
    }
    setErrorIndexes(new Set());

    const patch: PatchMealRequest = {
      ...(state.dirty
        ? {
            items: state.items.map((it) => ({
              ...toPatchItem(it),
              description: it.description.trim(),
            })),
          }
        : {}),
      ...(typeChanged ? { meal_type: mealType } : {}),
      ...(timeChanged ? { consumed_at: consumedAt } : {}),
    };

    update.mutate(patch, {
      onSuccess: (saved) => {
        resetTo(saved);
        toast({ variant: "success", message: "Alterações salvas" });
      },
      onError: () => toast({ variant: "error", message: "Não foi possível salvar" }),
    });
  };

  const isSaving = update.isPending || remove.isPending;
  const onOpenItem =
    <A,>(make: (index: number, arg: A) => EditMealAction) =>
    (arg: A) => {
      if (openIndex !== null) dispatch(make(openIndex, arg));
    };

  return (
    <SafeAreaView
      className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 font-display-bold text-xl text-neutral-800">Refeição</Text>
        <Pressable
          onPress={() => void deleteMeal("A refeição e todos os itens serão excluídos.")}
          disabled={isSaving}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={22} color={colors.danger[500]} />
        </Pressable>
      </View>

      <View className="gap-3 px-4 pb-3 pt-1">
        <MealMetaChips
          mealType={mealType}
          consumedAt={consumedAt}
          onChangeMealType={setMealType}
          onChangeTime={setConsumedAt}
        />
        <MealSummaryCard totals={totals} deltaKcal={totals.kcal - initialKcal} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pt-1"
        contentContainerStyle={{ paddingBottom: (dirty ? 0 : insets.bottom) + 24 }}
      >
        {meal.ai_feedback ? (
          <View
            testID="meal-ai-feedback"
            className="flex-row items-start gap-2 rounded-2xl bg-primary-50 p-4"
          >
            <Sparkles size={18} color={colors.primary[600]} />
            <Text className="flex-1 font-sans-medium text-sm text-primary-700">
              {meal.ai_feedback}
            </Text>
          </View>
        ) : null}
        {banner?.({ dirty })}
        <Text style={NUM} className="font-sans-semibold text-sm text-neutral-500">
          Itens · {state.items.length}
        </Text>
        {state.items.length === 0 ? (
          <View className="rounded-2xl border border-warning-300 bg-warning-50 p-4">
            <Text className="font-sans-semibold text-sm text-warning-700">Sem itens</Text>
            <Text className="mt-1 font-sans text-xs text-warning-600">
              Salvar sem itens vai excluir a refeição inteira.
            </Text>
          </View>
        ) : null}
        {state.items.map((item, index) => (
          <MealItemRow
            key={item.id ?? `new-${index}`}
            item={item}
            hasError={errorIndexes.has(index)}
            onOpen={() => setOpenIndex(index)}
            onStep={(direction) =>
              dispatch({
                type: "change_quantity",
                index,
                quantity: stepQuantity(item.quantity, item.unit, direction),
              })
            }
          />
        ))}
        <Pressable
          onPress={addItem}
          accessibilityRole="button"
          accessibilityLabel="Buscar e adicionar alimento"
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-[26px] border border-dashed border-neutral-300"
        >
          <Search size={18} color={colors.primary[700]} />
          <Text className="font-sans-semibold text-base text-primary-700">
            Buscar e adicionar alimento
          </Text>
        </Pressable>
        {!dirty && !meal.review_required ? <MealShareActions mealId={meal.id} /> : null}
      </ScrollView>

      {dirty ? (
        <MealEditorSaveBar
          saving={isSaving}
          onDiscard={() => resetTo(server)}
          onSave={() => void handleSave()}
        />
      ) : null}

      <MealItemSheet
        visible={openItem !== null}
        item={openItem}
        onClose={closeSheet}
        onRemove={() => {
          if (openIndex === null) return;
          if (isEmptyDraft) discardDraft(openIndex);
          else removeItem(openIndex);
        }}
        onSelectSuggestion={onOpenItem((index, suggestion: FoodSuggestion) => ({
          type: "select_suggestion",
          index,
          suggestion,
        }))}
        onChangeDescription={onOpenItem((index, description: string) => ({
          type: "change_description",
          index,
          description,
        }))}
        onChangeQuantity={onOpenItem((index, quantity: number) => ({
          type: "change_quantity",
          index,
          quantity,
        }))}
        onChangeUnit={onOpenItem((index, unit: Unit) => ({ type: "change_unit", index, unit }))}
        onChangeMacro={onOpenItem((index, patch: Partial<Macros>) => ({
          type: "change_macro",
          index,
          patch,
        }))}
        onResetCatalog={() => {
          if (openIndex !== null) dispatch({ type: "reset_catalog", index: openIndex });
        }}
      />
    </SafeAreaView>
  );
}
