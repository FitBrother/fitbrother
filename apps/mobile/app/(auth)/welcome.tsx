import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 justify-between p-12">
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-5xl font-display-bold text-primary-400">Fitbrother</Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            Nutrição com IA. Registre suas refeições em linguagem natural — texto ou áudio.
          </Text>
        </View>

        <View className="gap-3">
          <Button
            label="Criar conta"
            variant="primary"
            rightIcon={<ArrowRight size={18} color="#fff" />}
            onPress={() => router.push("/(auth)/sign-up")}
          />
          <Button
            label="Já tenho conta"
            variant="outline"
            onPress={() => router.push("/(auth)/sign-in")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
