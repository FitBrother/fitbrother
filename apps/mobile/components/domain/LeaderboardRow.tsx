import { Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { colors } from "@/lib/colors";

type LeaderboardRowProps = {
  position: number;
  fullName: string | null;
  windowStreak: number;
  weeklyHits: number;
  isMe: boolean;
};

/** Iniciais do nome como placeholder de avatar (profiles ainda não tem avatar). */
function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function LeaderboardRow({
  position,
  fullName,
  windowStreak,
  weeklyHits,
  isMe,
}: LeaderboardRowProps) {
  return (
    <View
      // 22px = o raio EFETIVO da barra de abas, que é `rounded-full` sobre 44px
      // de altura. `rounded-full` aqui daria 32, porque a linha tem ~64px por
      // causa do avatar — mesma classe, curva diferente. O valor fixo é o que
      // faz as duas curvas baterem de fato.
      className={`flex-row items-center rounded-[25px] p-3 ${
        isMe ? "bg-primary-50" : "border border-neutral-200 bg-white"
      }`}
      accessibilityRole="text"
      accessibilityLabel={`Posição ${position}, ${fullName ?? "amigo"}, ${weeklyHits} dias na meta`}
    >
      <Text
        className="w-8 font-sans-bold text-sm text-neutral-500"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        #{position}
      </Text>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-200">
        <Text className="font-sans-semibold text-sm text-neutral-700">{initials(fullName)}</Text>
      </View>
      <Text className="ml-3 flex-1 font-sans-semibold text-base text-neutral-800" numberOfLines={1}>
        {isMe ? "Você" : (fullName ?? "Amigo")}
      </Text>
      <View className="flex-row items-center gap-1">
        <Flame size={18} color={colors.streak[400]} />
        <Text
          className="font-sans-medium text-sm text-neutral-700"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {windowStreak}
        </Text>
      </View>
      <Text
        className="ml-3 font-sans-medium text-sm text-success-600"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        ✓ {weeklyHits}
      </Text>
    </View>
  );
}
