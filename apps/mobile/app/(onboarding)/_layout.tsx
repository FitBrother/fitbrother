import { Stack } from "expo-router";
import { View } from "react-native";
import { colors } from "@/lib/colors";

export default function OnboardingLayout() {
  return (
    <View className="flex-1 flex-row bg-neutral-100 md:justify-center">
      <View className="w-full flex-1 md:max-w-[440px]">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.neutral[50] },
            gestureEnabled: false,
          }}
        />
      </View>
    </View>
  );
}
