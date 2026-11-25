import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ImagePlus, Share2 } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { Button } from "@/components/Button";

export function MealShareActions({ mealId }: { mealId: string }) {
  const router = useRouter();

  return (
    <View className="mt-3 gap-2">
      <Button
        label="Compartilhar"
        accessibilityLabel="Compartilhar"
        accessibilityRole="button"
        leftIcon={<Share2 size={18} color={colors.neutral[900]} />}
        onPress={() => router.push(`/(app)/share/meal/${mealId}` as never)}
      />
      <Pressable
        onPress={() =>
          router.push({ pathname: "/(app)/post/new" as never, params: { meal_id: mealId } })
        }
        accessibilityRole="button"
        accessibilityLabel="Novo post"
        style={shadows.card}
        className="min-h-[52px] flex-row items-center justify-center rounded-full bg-white px-6 py-3 active:opacity-70"
      >
        <ImagePlus size={18} color={colors.neutral[700]} />
        <Text className="ml-2 font-sans-semibold text-base text-neutral-700">Novo post</Text>
      </Pressable>
    </View>
  );
}
