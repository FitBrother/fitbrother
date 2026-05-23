import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Trash2 } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { MealCard } from "./MealCard";

type Props = {
  meal: MealResponse;
  onPress?: () => void;
  onDelete: () => void;
};

export function MealCardSwipeable({ meal, onPress, onDelete }: Props) {
  const ref = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View className="mr-4 mt-3 items-center justify-center">
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          ref.current?.close();
          onDelete();
        }}
        accessibilityLabel="Excluir refeição"
        accessibilityRole="button"
        className="min-h-[44px] items-center justify-center rounded-2xl bg-danger-500 px-5 py-3"
      >
        <Trash2 size={20} color="#FFFFFF" />
        <Text className="mt-1 text-xs font-sans-semibold text-white">Excluir</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable ref={ref} renderRightActions={renderRightActions} overshootRight={false}>
      <MealCard meal={meal} onPress={onPress} />
    </Swipeable>
  );
}
