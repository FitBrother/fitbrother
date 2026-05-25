import { Text, View } from "react-native";
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
  return (
    <View className="mx-4 mt-3">
      <Text className="ml-1 mb-2 text-xs font-sans-semibold uppercase text-neutral-400">
        {formatDayHeader(day)}
      </Text>
      <View
        style={[shadows.card, { opacity: 0.65 }]}
        className="rounded-2xl bg-white p-4 items-center"
        accessibilityLabel={`Nenhuma refeição registrada em ${formatDayHeader(day)}`}
      >
        <MoonStar size={20} color={colors.neutral[400]} />
        <Text className="mt-2 text-sm font-sans-medium text-neutral-600">
          Nenhuma refeição registrada
        </Text>
        <Text className="mt-1 text-xs font-sans text-neutral-500 text-center">
          Que tal não deixar passar mais um dia?
        </Text>
      </View>
    </View>
  );
}
