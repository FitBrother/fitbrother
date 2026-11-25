import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";

type Props = {
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function MealEditorSaveBar({ saving, onDiscard, onSave }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: insets.bottom + 12 }}
      className="flex-row gap-3 border-t border-neutral-200 bg-white px-4 pt-3"
    >
      <Button
        label="Descartar"
        variant="outline"
        accessibilityLabel="Descartar"
        accessibilityRole="button"
        onPress={onDiscard}
        disabled={saving}
        className="flex-1"
      />
      <Button
        label="Salvar alterações"
        accessibilityLabel="Salvar alterações"
        accessibilityRole="button"
        onPress={onSave}
        loading={saving}
        className="flex-1"
      />
    </View>
  );
}
