import { ScrollView, Text, View } from "react-native";
import type { MealConfirmation } from "@/lib/hooks/useMealConfirmation";
import { DrawerBackButton } from "./ConfirmDrawerActions";
import { ItemEditorBody, ItemEditorFooter } from "./ItemEditorBody";

export function ConfirmItemView({
  index,
  confirmation: c,
}: {
  index: number;
  confirmation: MealConfirmation;
}) {
  const item = c.items[index];
  if (!item) return null;

  return (
    <View className="shrink">
      <View className="flex-row items-center gap-2 px-5 pb-2">
        <DrawerBackButton label="Voltar à lista" onPress={c.leaveItem} />
        <Text numberOfLines={1} className="flex-1 font-sans-semibold text-[17px] text-neutral-900">
          {item.description.trim() || "Novo item"}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <ItemEditorBody
          variant="drawer"
          hideFooter
          item={item}
          onClose={c.leaveItem}
          onRemove={c.removeOpenItem}
          onSelectSuggestion={(suggestion) =>
            c.dispatch({ type: "select_suggestion", index, suggestion })
          }
          onChangeDescription={(description) =>
            c.dispatch({ type: "change_description", index, description })
          }
          onChangeQuantity={(quantity) => c.dispatch({ type: "change_quantity", index, quantity })}
          onChangeUnit={(unit) => c.dispatch({ type: "change_unit", index, unit })}
          onChangeMacro={(patch) => c.dispatch({ type: "change_macro", index, patch })}
          onResetCatalog={() => c.dispatch({ type: "reset_catalog", index })}
        />
      </ScrollView>

      <ItemEditorFooter onClose={c.leaveItem} onRemove={c.removeOpenItem} />
    </View>
  );
}
