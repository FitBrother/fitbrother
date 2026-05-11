import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 items-center justify-center px-safe-horizontal">
        <Text className="text-4xl font-sans-extrabold text-primary-400 mb-2">Fitbrother</Text>
        <Text className="text-base font-sans text-neutral-500 text-center">
          Nutrição com IA — M0 foundation ✓
        </Text>
      </View>
    </SafeAreaView>
  );
}
