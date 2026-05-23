import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";

export default function FriendsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Amigos</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-base font-sans-medium text-neutral-500">
          Amigos chegam no próximo update.
        </Text>
      </View>
    </SafeAreaView>
  );
}
