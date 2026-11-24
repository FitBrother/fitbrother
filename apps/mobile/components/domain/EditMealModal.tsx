import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Trash2, X } from "lucide-react-native";
import {
  macrosForQuantity,
  PatchMealItemSchema,
  type FoodSuggestion,
  type Macros,
  type MealResponse,
  type PatchMealRequest,
  type Unit,
} from "@fitbrother/shared";
import {
  applySuggestion,
  changeDescription,
  changeMacro,
  changeQuantity,
  changeUnit,
  draftFromSavedItem,
  resetToCatalog,
  toPatchItem,
  type ItemDraft,
} from "@/lib/meal-item-draft";
import { UNIT_LABEL, UNIT_OPTIONS } from "@/lib/unit-labels";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useDialog } from "@/lib/dialog/dialog-context";
import { useToast } from "@/lib/toast/toast-context";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { FoodAutocomplete } from "./FoodAutocomplete";

type State = { items: ItemDraft[]; dirty: boolean };

type Action =
  | { type: "init"; items: ItemDraft[] }
  | { type: "select_suggestion"; index: number; suggestion: FoodSuggestion }
  | { type: "change_quantity"; index: number; quantity: number }
  | { type: "change_unit"; index: number; unit: Unit }
  | { type: "change_macro"; index: number; patch: Partial<Macros> }
  | { type: "change_description"; index: number; description: string }
  | { type: "reset_catalog"; index: number }
  | { type: "add_item" }
  | { type: "remove_item"; index: number };

function mapItem(state: State, index: number, fn: (d: ItemDraft) => ItemDraft): State {
  return { items: state.items.map((it, i) => (i === index ? fn(it) : it)), dirty: true };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return { items: action.items, dirty: false };
    case "select_suggestion":
      return mapItem(state, action.index, (d) => applySuggestion(d, action.suggestion));
    case "change_quantity":
      return mapItem(state, action.index, (d) => changeQuantity(d, action.quantity));
    case "change_unit":
      return mapItem(state, action.index, (d) => changeUnit(d, action.unit));
    case "change_macro":
      return mapItem(state, action.index, (d) => changeMacro(d, action.patch));
    case "change_description":
      return mapItem(state, action.index, (d) => changeDescription(d, action.description));
    case "reset_catalog":
      return mapItem(state, action.index, resetToCatalog);
    case "add_item":
      return {
        items: [
          ...state.items,
          {
            description: "",
            quantity: 1,
            unit: "unit",
            kcal: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            food_id: null,
            link: { mode: "none" },
            adjusted: false,
          },
        ],
        dirty: true,
      };
    case "remove_item":
      return {
        items: state.items.filter((_, i) => i !== action.index),
        dirty: true,
      };
  }
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  meal: MealResponse;
  day: string;
};

export function EditMealModal({ meal, day }: Props) {
  const router = useRouter();
  const update = useUpdateMeal(meal.id, day);
  const remove = useDeleteMeal();
  const dialog = useDialog();
  const toast = useToast();

  const [state, dispatch] = useReducer(reducer, {
    items: meal.items.map(draftFromSavedItem),
    dirty: false,
  });
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());

  const totals = useMemo(() => {
    return state.items.reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.kcal,
        protein_g: acc.protein_g + it.protein_g,
        carbs_g: acc.carbs_g + it.carbs_g,
        fat_g: acc.fat_g + it.fat_g,
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
  }, [state.items]);

  const handleClose = async () => {
    if (!state.dirty) {
      router.back();
      return;
    }
    const descartar = await dialog.confirm({
      title: "Descartar alterações?",
      description: "Você não salvou os ajustes.",
      confirmLabel: "Descartar",
      destructive: true,
    });
    if (descartar) router.back();
  };

  const handleSave = async () => {
    // Cascade: zero items → delete meal (com confirmação).
    if (state.items.length === 0) {
      const ok = await dialog.confirm({
        title: "Excluir refeição?",
        description: "Você removeu todos os itens. A refeição inteira será excluída.",
        confirmLabel: "Excluir",
        destructive: true,
      });
      if (!ok) return;
      remove.mutate(
        { id: meal.id, day },
        {
          onSuccess: () => router.replace("/(app)"),
          onError: () => toast({ variant: "error", message: "Não foi possível excluir" }),
        },
      );
      return;
    }

    const errors = new Set<number>();
    state.items.forEach((it, i) => {
      const parsed = PatchMealItemSchema.safeParse(toPatchItem(it));
      if (!parsed.success) errors.add(i);
    });
    if (errors.size > 0) {
      setErrorIndexes(errors);
      const list = Array.from(errors)
        .map((i) => i + 1)
        .join(", ");
      // Toast e não diálogo: os campos culpados já ficam marcados em vermelho
      // pelo `setErrorIndexes` acima, então a mensagem só precisa apontar para
      // onde olhar — e um diálogo cobriria justamente o que ela manda ver.
      toast({
        variant: "error",
        message: `Ite${errors.size > 1 ? "ns" : "m"} ${list} com campos inválidos`,
      });
      return;
    }
    setErrorIndexes(new Set());

    const patch: PatchMealRequest = {
      items: state.items.map((it) => ({ ...toPatchItem(it), description: it.description.trim() })),
    };

    update.mutate(patch, {
      onSuccess: () => router.back(),
      onError: () => toast({ variant: "error", message: "Não foi possível salvar" }),
    });
  };

  const isSaving = update.isPending || remove.isPending;

  return (
    <SafeAreaView
      className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => void handleClose()}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <X size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="flex-1 text-center text-base font-sans-bold text-neutral-800">
          Editar refeição
        </Text>
        <Pressable
          onPress={() => void handleSave()}
          disabled={!state.dirty || isSaving}
          accessibilityLabel="Salvar alterações"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[64px] items-center justify-center px-3 disabled:opacity-50"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary[400]} />
          ) : (
            <Text className="text-base font-sans-semibold text-primary-500">Salvar</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {state.items.length === 0 ? (
            <View
              style={shadows.card}
              className="mx-4 mt-3 rounded-2xl bg-warning-50 border border-warning-300 p-4"
            >
              <Text className="text-sm font-sans-semibold text-warning-700">Sem itens</Text>
              <Text className="mt-1 text-xs font-sans text-warning-600">
                Salvar sem itens vai excluir a refeição inteira.
              </Text>
            </View>
          ) : null}
          {state.items.map((item, idx) => (
            <ItemEditor
              key={item.id ?? `new-${idx}`}
              item={item}
              hasError={errorIndexes.has(idx)}
              dispatch={dispatch}
              index={idx}
              onRemove={() => dispatch({ type: "remove_item", index: idx })}
            />
          ))}

          <Pressable
            onPress={() => dispatch({ type: "add_item" })}
            accessibilityRole="button"
            accessibilityLabel="Adicionar item"
            className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-3"
          >
            <Plus size={18} color={colors.neutral[600]} />
            <Text className="text-base font-sans-medium text-neutral-600">Adicionar item</Text>
          </Pressable>

          <View
            style={shadows.card}
            className="mx-4 mt-5 rounded-2xl bg-white p-4"
            accessibilityLabel={`Totais: ${Math.round(totals.kcal)} kcal`}
          >
            <Text className="text-xs font-sans-semibold uppercase text-neutral-500">Totais</Text>
            <Text style={NUM} className="mt-1 text-2xl font-sans-bold text-neutral-800">
              {Math.round(totals.kcal)} kcal
            </Text>
            <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
              {Math.round(totals.protein_g)}g P · {Math.round(totals.carbs_g)}g C ·{" "}
              {Math.round(totals.fat_g)}g G
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ItemEditorProps = {
  item: ItemDraft;
  index: number;
  hasError: boolean;
  dispatch: (action: Action) => void;
  onRemove: () => void;
};

function unitConverts(item: ItemDraft): boolean {
  const { link } = item;
  if (link.mode === "food") {
    return macrosForQuantity(link.food, item.quantity, item.unit) !== null;
  }
  if (link.mode === "anchor") return item.unit === link.unit;
  return true;
}

function ItemEditor({ item, index, hasError, dispatch, onRemove }: ItemEditorProps) {
  const macro = (patch: Partial<Macros>) => dispatch({ type: "change_macro", index, patch });
  const showNoConversion = item.link.mode !== "none" && !unitConverts(item);

  return (
    <View
      style={shadows.card}
      className={`mx-4 mt-3 rounded-2xl bg-white p-4 ${hasError ? "border border-danger-500" : ""}`}
    >
      <FoodAutocomplete
        value={item.description}
        onChangeText={(description) => dispatch({ type: "change_description", index, description })}
        onSelect={(suggestion) => dispatch({ type: "select_suggestion", index, suggestion })}
      />

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput
          label="Qtd"
          value={item.quantity}
          onChange={(quantity) => dispatch({ type: "change_quantity", index, quantity })}
        />
        <UnitPicker
          value={item.unit}
          onChange={(unit) => dispatch({ type: "change_unit", index, unit })}
        />
      </View>
      {showNoConversion ? (
        <Text className="mt-1 text-xs font-sans text-neutral-500">
          Sem conversão para esta unidade
        </Text>
      ) : null}

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput label="kcal" value={item.kcal} onChange={(n) => macro({ kcal: n })} />
        <NumberInput
          label="P (g)"
          value={item.protein_g}
          onChange={(n) => macro({ protein_g: n })}
        />
        <NumberInput label="C (g)" value={item.carbs_g} onChange={(n) => macro({ carbs_g: n })} />
        <NumberInput label="G (g)" value={item.fat_g} onChange={(n) => macro({ fat_g: n })} />
      </View>

      {item.adjusted ? (
        <View className="mt-3 flex-row items-center justify-between">
          <View className="rounded-full bg-warning-50 px-2 py-1">
            <Text className="text-xs font-sans-medium text-warning-700">Ajustado</Text>
          </View>
          {item.link.mode === "food" ? (
            <Pressable
              onPress={() => dispatch({ type: "reset_catalog", index })}
              accessibilityRole="button"
              accessibilityLabel="Voltar ao catálogo"
              className="min-h-[44px] min-w-[44px] items-center justify-center px-2"
            >
              <Text className="text-sm font-sans-medium text-primary-500">Voltar ao catálogo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onRemove}
        accessibilityLabel="Remover item"
        accessibilityRole="button"
        className="mt-3 self-end min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <Trash2 size={18} color={colors.danger[500]} />
      </Pressable>
    </View>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <View className="flex-1">
      <Text className="text-xs font-sans-medium text-neutral-500">{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          const parsed = t === "" ? 0 : Number(t.replace(",", "."));
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label}, valor numérico`}
        style={NUM}
        className="mt-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-base font-sans-medium text-neutral-800"
      />
    </View>
  );
}

function UnitPicker({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text className="text-xs font-sans-medium text-neutral-500">Unidade</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="Escolher unidade"
        accessibilityRole="button"
        className="mt-1 min-w-[80px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5"
      >
        <Text className="text-base font-sans-medium text-neutral-800">{UNIT_LABEL[value]}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar seletor de unidade"
          accessibilityRole="button"
          className="flex-1 items-center justify-center bg-black/40 px-8"
        >
          <View
            style={shadows.card}
            className="w-full max-w-xs rounded-2xl bg-white py-2"
            onStartShouldSetResponder={() => true}
          >
            {UNIT_OPTIONS.map((u) => (
              <Pressable
                key={u}
                onPress={() => {
                  onChange(u);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: u === value }}
                className="px-4 py-3 active:bg-neutral-50"
              >
                <Text
                  className={`text-base ${
                    u === value
                      ? "font-sans-semibold text-primary-500"
                      : "font-sans-medium text-neutral-800"
                  }`}
                >
                  {UNIT_LABEL[u]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
