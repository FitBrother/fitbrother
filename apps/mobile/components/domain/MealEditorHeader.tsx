import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { colors } from "@/lib/colors";

type Props = {
  title: string;
  onBack: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
};

export function MealEditorHeader({ title, onBack, onDelete, deleteDisabled = false }: Props) {
  return (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        onPress={onBack}
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        className="min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <ChevronLeft size={24} color={colors.neutral[800]} />
      </Pressable>
      <Text className="ml-2 flex-1 font-display-bold text-xl text-neutral-800">{title}</Text>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          disabled={deleteDisabled}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={22} color={colors.danger[500]} />
        </Pressable>
      ) : null}
    </View>
  );
}
