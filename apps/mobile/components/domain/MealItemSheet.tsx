import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import type { FoodSuggestion, Macros, Unit } from "@fitbrother/shared";
import { shadows } from "@/lib/shadows";
import type { ItemDraft } from "@/lib/meal-item-draft";
import { ItemEditorBody } from "./ItemEditorBody";

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

export function MealItemSheet({ visible, item, ...handlers }: Props) {
  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handlers.onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-black/40"
      >
        <Pressable
          onPress={handlers.onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          className="flex-1"
        />
        <View style={shadows.floating} className="max-h-[88%] rounded-t-[26px] bg-white">
          <ItemEditorBody variant="sheet" item={item} {...handlers} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
