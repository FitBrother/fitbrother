import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf } from "lucide-react-native";
import { colors } from "@/lib/colors";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export type ShareCardData =
  | {
      kind: "meal";
      title: string;
      imageUrl: string | null;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }
  | {
      kind: "insight";
      title: string;
      headline: string;
      bullets: string[];
      score: number | null;
    };

function Watermark() {
  return (
    <View className="flex-row items-center gap-2">
      <Leaf size={28} color={colors.primary[400]} />
      <Text className="text-2xl font-sans-extrabold text-white">Fitbrother</Text>
    </View>
  );
}

/** Quadro 9:16 fixo. A tela de preview o envolve num View com ref p/ captura. */
export function ShareCard({ data }: { data: ShareCardData }) {
  return (
    <View style={{ width: 360, aspectRatio: 9 / 16 }} className="overflow-hidden rounded-3xl">
      <LinearGradient
        colors={[colors.primary[600], colors.primary[400]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {data.kind === "meal" ? (
          <View className="flex-1">
            {data.imageUrl ? (
              <Image
                source={{ uri: data.imageUrl }}
                accessibilityIgnoresInvertColors
                style={{ width: "100%", height: "55%" }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ height: "20%" }} />
            )}
            <View className="flex-1 justify-between p-7">
              <Text className="text-3xl font-sans-extrabold text-white">{data.title}</Text>
              <View>
                <Text style={NUM} className="text-6xl font-sans-extrabold text-white">
                  {Math.round(data.kcal)}
                </Text>
                <Text className="text-lg font-sans-medium text-white/90">kcal</Text>
                <Text style={NUM} className="mt-3 text-xl font-sans-semibold text-white/90">
                  {Math.round(data.protein_g)}g P · {Math.round(data.carbs_g)}g C ·{" "}
                  {Math.round(data.fat_g)}g G
                </Text>
              </View>
              <Watermark />
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-between p-7">
            <View>
              {data.score !== null ? (
                <Text style={NUM} className="text-7xl font-sans-extrabold text-white">
                  {data.score}
                </Text>
              ) : null}
              <Text className="mt-2 text-3xl font-sans-extrabold text-white">{data.title}</Text>
              <Text className="mt-2 text-xl font-sans-medium text-white/90">{data.headline}</Text>
            </View>
            <View className="gap-2">
              {data.bullets.slice(0, 3).map((b, i) => (
                <Text key={i} className="text-lg font-sans text-white/90">
                  • {b}
                </Text>
              ))}
            </View>
            <Watermark />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
