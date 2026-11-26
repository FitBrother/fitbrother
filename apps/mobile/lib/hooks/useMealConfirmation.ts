import { useMemo, useReducer, useRef, useState } from "react";
import type { MealResponse } from "@fitbrother/shared";
import { drawerViewReducer, type DrawerViewAction } from "@/lib/confirm-drawer";
import { editMealReducer, type EditMealAction } from "@/lib/edit-meal-reducer";
import { draftFromSavedItem } from "@/lib/meal-item-draft";
import { buildMealPatch, invalidItemIndexes } from "@/lib/meal-patch";
import { draftSignature, sameMinute, sumMacros } from "@/lib/meal-editor-state";
import { stepQuantity } from "@/lib/quantity-step";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useDialog } from "@/lib/dialog/dialog-context";
import { useToast } from "@/lib/toast/toast-context";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";

export function useMealConfirmation(meal: MealResponse, onClose: () => void) {
  const profile = useProfile();
  const dialog = useDialog();
  const toast = useToast();

  const [baseline, setBaseline] = useState(meal);
  const [seenSignature, setSeenSignature] = useState(() => draftSignature(meal));
  const [state, dispatchItems] = useReducer(editMealReducer, {
    items: meal.items.map(draftFromSavedItem),
    dirty: false,
  });
  const [mealType, setMealType] = useState(meal.meal_type);
  const [consumedAt, setConsumedAt] = useState(meal.consumed_at);
  const [view, go] = useReducer(drawerViewReducer, { name: "compact" });
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());
  const submitting = useRef(false);

  const typeChanged = mealType !== baseline.meal_type;
  const timeChanged = !sameMinute(consumedAt, baseline.consumed_at);
  const dirty = state.dirty || typeChanged || timeChanged;
  const day = nutritionalDay(new Date(baseline.consumed_at), profile);
  const newDay = timeChanged ? nutritionalDay(new Date(consumedAt), profile) : undefined;

  const resetTo = (m: MealResponse) => {
    setBaseline(m);
    dispatchItems({ type: "init", items: m.items.map(draftFromSavedItem) });
    setMealType(m.meal_type);
    setConsumedAt(m.consumed_at);
    setErrorIndexes(new Set());
  };

  // A newer server copy replaces only an untouched draft.
  const propSignature = draftSignature(meal);
  if (propSignature !== seenSignature) {
    setSeenSignature(propSignature);
    if (!dirty) resetTo(meal);
  }

  const update = useUpdateMeal(meal.id, day, newDay);
  const remove = useDeleteMeal();
  const busy = update.isPending || remove.isPending;
  const totals = useMemo(() => sumMacros(state.items), [state.items]);

  const dispatch = (action: EditMealAction) => {
    if (!busy) dispatchItems(action);
  };
  const navigate = (action: DrawerViewAction) => {
    if (!busy) go(action);
  };

  const dropErrorAt = (index: number) =>
    setErrorIndexes(
      (prev) =>
        new Set(
          Array.from(prev)
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i)),
        ),
    );

  const isEmptyDraft = (index: number) => {
    const item = state.items[index];
    return item !== undefined && !item.id && item.description.trim() === "";
  };

  const discardDraft = (index: number) => {
    dropErrorAt(index);
    dispatchItems({ type: "discard_draft", index });
  };

  const discard = async () => {
    if (submitting.current || busy) return;
    const ok = await dialog.confirm({
      title: "Descartar refeição?",
      description: "Ela será excluída e não entra no seu dia.",
      confirmLabel: "Descartar",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(
      { id: meal.id, day },
      {
        onSuccess: onClose,
        onError: () => toast({ variant: "error", message: "Não foi possível excluir" }),
      },
    );
  };

  const confirm = () => {
    if (submitting.current || busy) return;
    if (state.items.length === 0) {
      void discard();
      return;
    }

    const errors = invalidItemIndexes(state.items);
    if (errors.size > 0) {
      setErrorIndexes(errors);
      go({ type: "adjust" });
      const list = Array.from(errors)
        .map((i) => i + 1)
        .join(", ");
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
      confirm: true,
    });

    submitting.current = true;
    update.mutate(patch, {
      onSuccess: (saved) => {
        submitting.current = false;
        resetTo(saved);
        // A server without confirm support saves the edits but leaves the meal pending.
        if (saved.review_required) {
          toast({ variant: "error", message: "Não foi possível confirmar" });
          return;
        }
        toast({ variant: "success", message: "Refeição registrada" });
        onClose();
      },
      onError: () => {
        submitting.current = false;
        toast({ variant: "error", message: "Não foi possível confirmar" });
      },
    });
  };

  const addItem = () => {
    if (busy) return;
    go({ type: "edit_item", index: state.items.length });
    dispatchItems({ type: "add_item" });
  };

  const leaveItem = () => {
    if (view.name !== "item") return;
    if (isEmptyDraft(view.index)) discardDraft(view.index);
    go({ type: "done_item" });
  };

  const removeOpenItem = () => {
    if (view.name !== "item") return;
    const index = view.index;
    go({ type: "done_item" });
    if (isEmptyDraft(index)) {
      discardDraft(index);
      return;
    }
    if (state.items.length <= 1) {
      void discard();
      return;
    }
    dropErrorAt(index);
    dispatchItems({ type: "remove_item", index });
  };

  const stepItem = (index: number, direction: 1 | -1) => {
    const item = state.items[index];
    if (!item) return;
    dispatch({
      type: "change_quantity",
      index,
      quantity: stepQuantity(item.quantity, item.unit, direction),
    });
  };

  return {
    view,
    items: state.items,
    totals,
    mealType,
    consumedAt,
    errorIndexes,
    dirty,
    busy,
    sending: update.isPending,
    setMealType: (t: MealResponse["meal_type"]) => !busy && setMealType(t),
    setConsumedAt: (iso: string) => !busy && setConsumedAt(iso),
    dispatch,
    adjust: () => navigate({ type: "adjust" }),
    back: () => navigate({ type: "back" }),
    openItem: (index: number) => navigate({ type: "edit_item", index }),
    addItem,
    leaveItem,
    removeOpenItem,
    stepItem,
    confirm,
    discard: () => void discard(),
  };
}

export type MealConfirmation = ReturnType<typeof useMealConfirmation>;
