import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import type { FoodSuggestion, Macros, Unit } from "@fitbrother/shared";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { canDecreaseQuantity, quickAmounts, stepQuantity } from "@/lib/quantity-step";
import { UNIT_LABEL, UNIT_OPTIONS } from "@/lib/unit-labels";
import { unitConverts, type ItemDraft } from "@/lib/meal-item-draft";
import { FoodAutocomplete } from "./FoodAutocomplete";
import { formatNumber, MacroEditFields, NumberField } from "./MacroEditFields";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  visible: boolean;
  item: ItemDraft | null;
  onClose: () => void;
  onRemove: () => void;
  onSelectSuggestion: (s: FoodSuggestion) => void;
  onChangeDescription: (t: string) => void;
  onChangeQuantity: (q: number) => void;
  onChangeUnit: (u: Unit) => void;
  onChangeMacro: (patch: Partial<Macros>) => void;
  onResetCatalog: () => void;
};

function macrosLabel(item: ItemDraft): string {
  if (item.link.mode === "none") return "Informe os macros";
  if (item.adjusted) return "Ajustado manualmente";
  return item.link.mode === "food"
    ? "Calculado pelo catálogo"
    : "Proporcional ao registro original";
}

function MacroDot({
  className,
  grams,
  short,
}: {
  className: string;
  grams: number;
  short: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-2.5 w-2.5 rounded-full ${className}`} />
      <Text style={NUM} className="font-sans-medium text-sm text-neutral-700">
        {Math.round(grams * 10) / 10} g {short}
      </Text>
    </View>
  );
}

export function MealItemSheet(props: Props) {
  const { visible, item, onClose } = props;
  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetBody {...props} item={item} />
    </Modal>
  );
}

function SheetBody({
  item,
  onClose,
  onRemove,
  onSelectSuggestion,
  onChangeDescription,
  onChangeQuantity,
  onChangeUnit,
  onChangeMacro,
  onResetCatalog,
}: Props & { item: ItemDraft }) {
  const [userManual, setUserManual] = useState(false);
  const manual = item.adjusted || userManual;

  const isFree = item.link.mode === "none";
  const showFields = isFree || manual;
  const quantityValid = Number.isFinite(item.quantity) && item.quantity > 0;
  const amounts = quickAmounts(item.unit, quantityValid ? item.quantity : 0).filter((n) => n > 0);
  const canDecrease = canDecreaseQuantity(item.quantity, item.unit);
  const showNoConversion = !isFree && !unitConverts(item);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-black/40"
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        className="flex-1"
      />
      <View style={shadows.floating} className="max-h-[88%] rounded-t-[26px] bg-white">
        <View className="items-center pb-2 pt-3">
          <View className="h-1 w-9 rounded-full bg-neutral-300" />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-2">
            <Text className="font-sans-medium text-xs text-neutral-500">Alimento</Text>
            {item.link.mode === "food" ? (
              <View className="rounded-full bg-neutral-900 px-2 py-0.5">
                <Text className="font-sans-bold text-[10px] text-white">TACO</Text>
              </View>
            ) : null}
          </View>
          <FoodAutocomplete
            value={item.description}
            onChangeText={onChangeDescription}
            onSelect={onSelectSuggestion}
          />

          <Text className="mt-4 font-sans-medium text-xs text-neutral-500">Quantidade</Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Pressable
              onPress={() => onChangeQuantity(stepQuantity(item.quantity, item.unit, -1))}
              disabled={!canDecrease}
              accessibilityRole="button"
              accessibilityLabel="Diminuir quantidade"
              accessibilityState={{ disabled: !canDecrease }}
              className={`h-14 w-14 items-center justify-center rounded-full bg-neutral-100 ${
                canDecrease ? "" : "opacity-40"
              }`}
            >
              <Minus size={24} color={colors.neutral[700]} />
            </Pressable>
            <View className="items-center">
              <NumberField
                accessibilityLabel="Quantidade"
                value={item.quantity}
                onChange={onChangeQuantity}
                className="min-w-[96px] text-center font-display-bold text-[44px] leading-[52px] text-neutral-900"
              />
              <Text className="font-sans-medium text-sm text-neutral-500">
                {UNIT_LABEL[item.unit]}
              </Text>
            </View>
            <Pressable
              onPress={() => onChangeQuantity(stepQuantity(item.quantity, item.unit, 1))}
              accessibilityRole="button"
              accessibilityLabel="Aumentar quantidade"
              className="h-14 w-14 items-center justify-center rounded-full bg-primary-400"
            >
              <Plus size={24} color={colors.neutral[900]} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="mt-3"
            contentContainerClassName="gap-2"
          >
            {amounts.map((n) => {
              const selected = n === item.quantity;
              return (
                <Pressable
                  key={n}
                  onPress={() => onChangeQuantity(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatNumber(n)} ${UNIT_LABEL[item.unit]}`}
                  accessibilityState={{ selected }}
                  className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 ${
                    selected ? "bg-neutral-900" : "bg-neutral-100"
                  }`}
                >
                  <Text
                    style={NUM}
                    className={`font-sans-semibold text-sm ${
                      selected ? "text-white" : "text-neutral-700"
                    }`}
                  >
                    {formatNumber(n)} {UNIT_LABEL[item.unit]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="mt-3"
          >
            <View className="flex-row rounded-full bg-neutral-100 p-1">
              {UNIT_OPTIONS.map((u) => {
                const selected = u === item.unit;
                return (
                  <Pressable
                    key={u}
                    onPress={() => onChangeUnit(u)}
                    accessibilityRole="button"
                    accessibilityLabel={`Unidade ${UNIT_LABEL[u]}`}
                    accessibilityState={{ selected }}
                    className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 ${
                      selected ? "bg-white" : ""
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selected
                          ? "font-sans-semibold text-neutral-900"
                          : "font-sans-medium text-neutral-500"
                      }`}
                    >
                      {UNIT_LABEL[u]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {showNoConversion ? (
            <Text className="mt-2 font-sans text-xs text-neutral-500">
              Sem conversão para esta unidade
            </Text>
          ) : null}

          <View className="mt-4 rounded-2xl bg-neutral-100 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 font-sans-medium text-xs text-neutral-500">
                {macrosLabel(item)}
              </Text>
              {item.adjusted && item.link.mode === "food" ? (
                <Pressable
                  onPress={onResetCatalog}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar ao catálogo"
                  className="min-h-[44px] items-center justify-center pl-2"
                >
                  <Text className="font-sans-semibold text-sm text-primary-700">
                    Voltar ao catálogo
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={NUM} className="font-display-bold text-[32px] text-neutral-900">
              {Math.round(item.kcal)} <Text className="font-sans-medium text-base">kcal</Text>
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
              <MacroDot className="bg-protein-500" grams={item.protein_g} short="P" />
              <MacroDot className="bg-carbs-500" grams={item.carbs_g} short="C" />
              <MacroDot className="bg-fat-500" grams={item.fat_g} short="G" />
            </View>

            {!isFree ? (
              <View className="mt-3 min-h-[44px] flex-row items-center justify-between border-t border-neutral-200 pt-2">
                <Text className="font-sans-medium text-sm text-neutral-800">
                  Ajustar macros manualmente
                </Text>
                <Switch
                  value={manual}
                  onValueChange={setUserManual}
                  disabled={item.adjusted}
                  accessibilityState={{ disabled: item.adjusted }}
                  accessibilityRole="switch"
                  accessibilityLabel="Ajustar macros manualmente"
                  trackColor={{ false: colors.neutral[200], true: colors.primary[400] }}
                />
              </View>
            ) : null}
            {showFields ? <MacroEditFields item={item} onChangeMacro={onChangeMacro} /> : null}
          </View>
        </ScrollView>

        <SafeAreaView edges={["bottom"]}>
          <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Remover item"
              className="h-[52px] w-[52px] items-center justify-center rounded-full border border-danger-500"
            >
              <Trash2 size={20} color={colors.danger[500]} />
            </Pressable>
            <Button label="Concluir item" onPress={onClose} className="flex-1" />
          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}
