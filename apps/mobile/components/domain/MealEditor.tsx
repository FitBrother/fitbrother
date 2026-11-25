import { useMemo, useReducer, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search, Sparkles } from "lucide-react-native";
import type { FoodSuggestion, Macros, MealResponse, Unit } from "@fitbrother/shared";
import { draftFromSavedItem } from "@/lib/meal-item-draft";
import { buildMealPatch, invalidItemIndexes } from "@/lib/meal-patch";
import { draftSignature, sameMinute, sumMacros } from "@/lib/meal-editor-state";
import { backOrHome } from "@/lib/navigation";
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
import { MealEditorHeader } from "./MealEditorHeader";
import { MealEditorSaveBar } from "./MealEditorSaveBar";
import { MealItemRow } from "./MealItemRow";
import { MealItemSheet } from "./MealItemSheet";
import { MealMetaChips } from "./MealMetaChips";
import { MealPendingBar } from "./MealPendingBar";
import { MealShareActions } from "./MealShareActions";
import { MealSourceCard } from "./MealSourceCard";
import { MealSummaryCard } from "./MealSummaryCard";
import { MealUncertainBanner } from "./MealUncertainBanner";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

const LOW_CONFIDENCE = 0.6;

type Props = { meal: MealResponse };

export function MealEditor({ meal }: Props) {
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
  const [confirmed, setConfirmed] = useState(false);
  const submitting = useRef(false);

  const typeChanged = mealType !== baseline.meal_type;
  const timeChanged = !sameMinute(consumedAt, baseline.consumed_at);
  const newDay = timeChanged ? nutritionalDay(new Date(consumedAt), profile) : undefined;
  const dirty = state.dirty || typeChanged || timeChanged;
  const day = nutritionalDay(new Date(baseline.consumed_at), profile);
  const pending = meal.review_required && !confirmed;

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

  const deleteMeal = async (
    description: string,
    { title = "Excluir refeição?", confirmLabel = "Excluir" } = {},
  ) => {
    const ok = await dialog.confirm({ title, description, confirmLabel, destructive: true });
    if (!ok) return;
    remove.mutate(
      { id: meal.id, day },
      {
        onSuccess: () => {
          guard.allowLeave();
          backOrHome(router);
        },
        onError: () => toast({ variant: "error", message: "Não foi possível excluir" }),
      },
    );
  };

  const submit = async (confirm: boolean) => {
    if (submitting.current) return;
    setOpenIndex(null);
    if (state.items.length === 0) {
      await deleteMeal("Você removeu todos os itens. A refeição inteira será excluída.");
      return;
    }

    const errors = invalidItemIndexes(state.items);
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

    const patch = buildMealPatch({
      items: state.dirty ? state.items : undefined,
      mealType: typeChanged ? mealType : undefined,
      consumedAt: timeChanged ? consumedAt : undefined,
      confirm,
    });

    submitting.current = true;
    update.mutate(patch, {
      onSuccess: (saved) => {
        submitting.current = false;
        resetTo(saved);
        if (confirm) setConfirmed(true);
        toast({
          variant: "success",
          message: confirm ? "Refeição registrada" : "Alterações salvas",
        });
      },
      onError: () => {
        submitting.current = false;
        toast({
          variant: "error",
          message: confirm ? "Não foi possível confirmar" : "Não foi possível salvar",
        });
      },
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
      <MealEditorHeader
        title={pending ? "Confirme o que entendi" : "Refeição"}
        onBack={() => backOrHome(router)}
        onDelete={
          pending
            ? undefined
            : () => void deleteMeal("A refeição e todos os itens serão excluídos.")
        }
        deleteDisabled={isSaving}
      />

      <View className="gap-3 px-4 pb-3 pt-1">
        {pending ? <MealSourceCard meal={meal} /> : null}
        <MealMetaChips
          mealType={mealType}
          consumedAt={consumedAt}
          onChangeMealType={setMealType}
          onChangeTime={setConsumedAt}
          disabled={isSaving}
        />
        <MealSummaryCard
          totals={totals}
          deltaKcal={totals.kcal - initialKcal}
          pendingNote={pending ? "ainda não conta no seu dia" : undefined}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pt-1"
        contentContainerStyle={{ paddingBottom: (dirty || pending ? 0 : insets.bottom) + 24 }}
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
        {pending && meal.confidence !== null && meal.confidence < LOW_CONFIDENCE ? (
          <MealUncertainBanner />
        ) : null}
        <View className="flex-row items-baseline justify-between">
          <Text style={NUM} className="font-sans-semibold text-sm text-neutral-500">
            Itens · {state.items.length}
          </Text>
          {pending ? (
            <Text className="font-sans text-xs text-neutral-500">Ajuste o que estiver errado</Text>
          ) : null}
        </View>
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
            disabled={isSaving}
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
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Buscar e adicionar alimento"
          accessibilityState={{ disabled: isSaving }}
          className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[26px] border border-dashed border-neutral-300 ${
            isSaving ? "opacity-50" : ""
          }`}
        >
          <Search size={18} color={colors.primary[700]} />
          <Text className="font-sans-semibold text-base text-primary-700">
            Buscar e adicionar alimento
          </Text>
        </Pressable>
        {!dirty && !pending ? <MealShareActions mealId={meal.id} /> : null}
      </ScrollView>

      {pending ? (
        <MealPendingBar
          saving={isSaving}
          onConfirm={() => void submit(true)}
          onDiscard={() =>
            void deleteMeal("Ela será excluída e não entra no seu dia.", {
              title: "Descartar refeição?",
              confirmLabel: "Descartar",
            })
          }
        />
      ) : dirty ? (
        <MealEditorSaveBar
          saving={isSaving}
          onDiscard={() => resetTo(server)}
          onSave={() => void submit(false)}
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
