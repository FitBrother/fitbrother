import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";

type Props = {
  saving: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
};

export function MealPendingBar({ saving, onConfirm, onDiscard }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: insets.bottom + 4 }}
      className="gap-1 border-t border-neutral-200 bg-white px-4 pt-3"
    >
      <Button
        label="Confirmar refeição"
        accessibilityLabel="Confirmar refeição"
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
        onPress={onConfirm}
        loading={saving}
        className="w-full"
      />
      <Pressable
        onPress={onDiscard}
        disabled={saving}
        accessibilityLabel="Descartar refeição"
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        className={`min-h-[44px] items-center justify-center ${saving ? "opacity-50" : ""}`}
      >
        <Text className="font-sans-semibold text-sm text-danger-700">Descartar refeição</Text>
      </Pressable>
    </View>
  );
}
