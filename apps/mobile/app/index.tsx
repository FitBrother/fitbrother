import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

export default function Index() {
  const auth = useAuthSession();

  if (auth.status === "loading") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color="#2DD4BF" />
      </SafeAreaView>
    );
  }

  if (auth.status === "signed_out") {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Authenticated — placeholder home until the real tabs UI lands.
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 items-center justify-center px-5">
        <Text className="mb-2 text-3xl font-sans-extrabold text-primary-400">Fitbrother</Text>
        <Text className="text-center text-base font-sans text-neutral-600">
          Conta ativa. Dashboard nutricional em breve.
        </Text>
      </View>
    </SafeAreaView>
  );
}
