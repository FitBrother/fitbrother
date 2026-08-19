import { Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { colors } from "@/lib/colors";
import { PRIVACY_URL, TERMS_URL } from "@/lib/constants";

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "—";

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
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Sobre</Text>
      </View>

      <View className="gap-4 px-5 pt-4">
        <Text className="font-sans text-neutral-600">Fitbrother — versão {version}</Text>
        <Pressable
          onPress={() => void Linking.openURL(TERMS_URL)}
          accessibilityRole="link"
          className="min-h-[44px] justify-center"
        >
          <Text className="font-sans-medium text-primary-500">Termos de uso</Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
          className="min-h-[44px] justify-center"
        >
          <Text className="font-sans-medium text-primary-500">Política de privacidade</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
