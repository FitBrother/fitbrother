import type { Insight } from "@fitbrother/shared";
import { Text, View } from "react-native";
import { shadows } from "@/lib/shadows";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function InsightCard({ insight }: { insight: Insight }) {
  const p = insight.payload;
  return (
    <View style={shadows.card} className="rounded-2xl bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-sans-extrabold text-neutral-800">{p.title}</Text>
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
    </View>
  );
}
