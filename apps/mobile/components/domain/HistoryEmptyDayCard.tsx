import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MoonStar } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Props = {
  day: string;
};

function formatDayHeader(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HistoryEmptyDayCard({ day }: Props) {
  const router = useRouter();
  return (
    <View className="mx-4 mt-3">
      <Text className="ml-1 mb-2 text-xs font-sans-semibold uppercase text-neutral-400">
        {formatDayHeader(day)}
      </Text>
      <Pressable
        onPress={() =>
          router.push({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pathname: "/(app)/history/[day]" as any,
            params: { day },
          })
        }
        accessibilityLabel={`Ver dia ${formatDayHeader(day)} (sem refeições registradas)`}
        accessibilityRole="button"
        style={[shadows.card, { opacity: 0.65 }]}
        className="items-center rounded-[25px] bg-white p-4"
      >
        <MoonStar size={20} color={colors.neutral[400]} />
        <Text className="mt-2 text-sm font-sans-medium text-neutral-600">
          Nenhuma refeição registrada
        </Text>
        <Text className="mt-1 text-center text-xs font-sans text-neutral-500">
          Que tal não deixar passar mais um dia?
        </Text>
      </Pressable>
    </View>
  );
}
