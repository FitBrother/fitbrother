import { Pressable, ScrollView, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { colors } from "@/lib/colors";
import type { MealConfirmation } from "@/lib/hooks/useMealConfirmation";
import { ConfirmButton, DiscardLink, DrawerBackButton, KcalTotal } from "./ConfirmDrawerActions";
import { DrawerItemRow } from "./DrawerItemRow";
import { MealMetaLine } from "./MealMetaLine";

export function ConfirmAdjustView({ confirmation: c }: { confirmation: MealConfirmation }) {
  return (
    <View className="shrink">
      <View className="flex-row items-center gap-2 px-5 pb-2">
        <DrawerBackButton label="Voltar ao resumo" disabled={c.busy} onPress={c.back} />
        <Text numberOfLines={1} className="flex-1 font-display-bold text-xl text-neutral-900">
          Ajustar refeição
        </Text>
        <KcalTotal kcal={c.totals.kcal} size="sm" />
      </View>
      <View className="h-px bg-neutral-100" />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5">
        {c.items.map((item, index) => (
          <DrawerItemRow
            key={item.id ?? `new-${index}`}
            item={item}
            hasError={c.errorIndexes.has(index)}
            disabled={c.busy}
            onOpen={() => c.openItem(index)}
            onStep={(direction) => c.stepItem(index, direction)}
          />
        ))}
      </ScrollView>

      <View className="gap-1 px-5 pt-2">
        <Pressable
          onPress={c.addItem}
          disabled={c.busy}
          accessibilityRole="button"
          accessibilityLabel="Adicionar item"
          accessibilityState={{ disabled: c.busy }}
          className={`min-h-[44px] flex-row items-center gap-1.5 self-start ${
            c.busy ? "opacity-50" : ""
          }`}
        >
          <Plus size={18} color={colors.primary[700]} />
          <Text className="font-sans-semibold text-base text-primary-700">Adicionar item</Text>
        </Pressable>
        <MealMetaLine
          mealType={c.mealType}
          consumedAt={c.consumedAt}
          onChangeMealType={c.setMealType}
          onChangeTime={c.setConsumedAt}
          disabled={c.busy}
        />
        <ConfirmButton sending={c.sending} disabled={c.busy} onPress={c.confirm} />
        <DiscardLink disabled={c.busy} onPress={c.discard} />
      </View>
    </View>
  );
}
