import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Trash2, X } from "lucide-react-native";
import { PatchMealItemSchema, type MealResponse, type PatchMealRequest } from "@fitbrother/shared";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Unit = MealResponse["items"][number]["unit"];
const UNIT_OPTIONS: Unit[] = ["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"];
const UNIT_LABEL: Record<Unit, string> = {
  g: "g",
  ml: "ml",
  unit: "un",
  slice: "fatia",
  cup: "xíc",
  tbsp: "c. sopa",
  tsp: "c. chá",
};

type ItemDraft = {
  id?: string;
  description: string;
  quantity: number;
  unit: Unit;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type State = { items: ItemDraft[]; dirty: boolean };

type Action =
  | { type: "init"; items: ItemDraft[] }
  | { type: "update_item"; index: number; patch: Partial<ItemDraft> }
  | { type: "add_item" }
  | { type: "remove_item"; index: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return { items: action.items, dirty: false };
    case "update_item": {
      const items = state.items.map((it, i) =>
        i === action.index ? { ...it, ...action.patch } : it,
      );
      return { items, dirty: true };
    }
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

  const [state, dispatch] = useReducer(reducer, {
    items: meal.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      kcal: it.kcal,
      protein_g: it.protein_g,
      carbs_g: it.carbs_g,
      fat_g: it.fat_g,
    })),
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

  const handleClose = () => {
    if (!state.dirty) {
      router.back();
      return;
    }
    Alert.alert("Descartar alterações?", "Você não salvou os ajustes.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const handleSave = () => {
    const errors = new Set<number>();
    state.items.forEach((it, i) => {
      const parsed = PatchMealItemSchema.safeParse(it);
      if (!parsed.success) errors.add(i);
    });
    if (errors.size > 0) {
      setErrorIndexes(errors);
      const list = Array.from(errors)
        .map((i) => i + 1)
        .join(", ");
      Alert.alert(
        "Campos inválidos",
        `Item${errors.size > 1 ? "s" : ""} ${list} tem campos inválidos.`,
      );
      return;
    }
    setErrorIndexes(new Set());

    const patch: PatchMealRequest = {
      items: state.items.map((it) => ({
        id: it.id,
        description: it.description.trim(),
        quantity: it.quantity,
        unit: it.unit,
        kcal: it.kcal,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
      })),
    };

    update.mutate(patch, {
      onSuccess: () => router.back(),
      onError: () => Alert.alert("Não foi possível salvar", "Tente novamente em instantes."),
    });
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    dispatch({ type: "update_item", index, patch });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={handleClose}
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
          onPress={handleSave}
          disabled={!state.dirty || update.isPending}
          accessibilityLabel="Salvar alterações"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[64px] items-center justify-center px-3 disabled:opacity-50"
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color={colors.primary[400]} />
          ) : (
            <Text className="text-base font-sans-semibold text-primary-500">Salvar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {state.items.map((item, idx) => (
          <ItemEditor
            key={item.id ?? `new-${idx}`}
            item={item}
            hasError={errorIndexes.has(idx)}
            canDelete={state.items.length > 1}
            onChange={(patch) => updateItem(idx, patch)}
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
    </SafeAreaView>
  );
}

type ItemEditorProps = {
  item: ItemDraft;
  hasError: boolean;
  canDelete: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
};

function ItemEditor({ item, hasError, canDelete, onChange, onRemove }: ItemEditorProps) {
  return (
    <View
      style={shadows.card}
      className={`mx-4 mt-3 rounded-2xl bg-white p-4 ${hasError ? "border border-danger-500" : ""}`}
    >
      <TextInput
        value={item.description}
        onChangeText={(t) => onChange({ description: t })}
        placeholder="Descrição"
        accessibilityLabel="Descrição do item"
        maxLength={60}
        className="text-base font-sans-medium text-neutral-800"
      />

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput
          label="Qtd"
          value={item.quantity}
          onChange={(n) => onChange({ quantity: n })}
        />
        <UnitPicker value={item.unit} onChange={(u) => onChange({ unit: u })} />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput label="kcal" value={item.kcal} onChange={(n) => onChange({ kcal: n })} />
        <NumberInput
          label="P (g)"
          value={item.protein_g}
          onChange={(n) => onChange({ protein_g: n })}
        />
        <NumberInput
          label="C (g)"
          value={item.carbs_g}
          onChange={(n) => onChange({ carbs_g: n })}
        />
        <NumberInput label="G (g)" value={item.fat_g} onChange={(n) => onChange({ fat_g: n })} />
      </View>

      <Pressable
        onPress={onRemove}
        disabled={!canDelete}
        accessibilityLabel="Remover item"
        accessibilityRole="button"
        className="mt-3 self-end min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-30"
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
    <View className="relative">
      <Text className="text-xs font-sans-medium text-neutral-500">Unidade</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel="Escolher unidade"
        accessibilityRole="button"
        className="mt-1 min-w-[80px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5"
      >
        <Text className="text-base font-sans-medium text-neutral-800">{UNIT_LABEL[value]}</Text>
      </Pressable>
      {open ? (
        <View style={shadows.card} className="absolute left-0 top-16 z-50 w-32 rounded-lg bg-white">
          {UNIT_OPTIONS.map((u) => (
            <Pressable
              key={u}
              onPress={() => {
                onChange(u);
                setOpen(false);
              }}
              accessibilityRole="button"
              className="px-3 py-2 active:bg-neutral-50"
            >
              <Text className="text-base font-sans-medium text-neutral-800">{UNIT_LABEL[u]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
