import { Pressable, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { oldestPending } from "@/lib/pending-meals";

type Props = {
  meals: readonly MealResponse[];
  onOpen: (id: string) => void;
};

export function PendingMealsBanner({ meals, onOpen }: Props) {
  const oldest = oldestPending(meals);
  if (!oldest) return null;

  const count = meals.length;
  const text =
    count === 1 ? "1 refeição aguardando confirmação" : `${count} refeições aguardando confirmação`;

  return (
    <View
      accessible
      accessibilityLabel={text}
      className="flex-row items-center gap-3 rounded-[16px] border-[1.5px] border-warning-500 bg-warning-50 py-2 pl-3 pr-2"
    >
      <AlertTriangle size={18} color={colors.warning[700]} />
      <Text
        style={{ fontVariant: ["tabular-nums"] }}
        className="flex-1 text-sm font-sans-medium text-warning-700"
      >
        {text}
      </Text>
      <Pressable
        onPress={() => onOpen(oldest.id)}
        accessibilityRole="button"
        accessibilityLabel="Confirmar refeição pendente"
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary-400 px-4 active:opacity-70"
      >
        <Text className="text-sm font-sans-bold text-white">Confirmar</Text>
      </Pressable>
    </View>
  );
}
