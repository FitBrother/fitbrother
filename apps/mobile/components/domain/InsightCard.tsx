import type { Insight } from "@fitbrother/shared";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Share2 } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function InsightCard({ insight }: { insight: Insight }) {
  const router = useRouter();
  const p = insight.payload;
  return (
    <View style={shadows.card} className="rounded-[25px] bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-display-bold text-neutral-800">{p.title}</Text>
        {p.score !== null ? (
          <Text style={NUM} className="ml-3 font-sans-bold text-primary-600">
            {p.score}
          </Text>
        ) : null}
      </View>
      <Text className="mt-1 font-sans text-neutral-600">{p.headline}</Text>
      <View className="mt-3 gap-1.5">
        {p.bullets.map((b, i) => (
          <Text key={i} className="font-sans text-sm text-neutral-700">
            • {b}
          </Text>
        ))}
      </View>
      <Pressable
        onPress={() => router.push(`/(app)/share/insight/${insight.id}` as never)}
        accessibilityRole="button"
        accessibilityLabel="Exportar imagem"
        className="mt-3 min-h-[44px] flex-row items-center gap-2 self-start rounded-full bg-neutral-100 px-4"
      >
        <Share2 size={18} color={colors.neutral[700]} />
        <Text className="font-sans-medium text-neutral-700">Exportar imagem</Text>
      </Pressable>
    </View>
  );
}
