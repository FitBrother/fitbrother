import { Stack } from "expo-router";
import { colors } from "@/lib/colors";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.neutral[50] },
        gestureEnabled: false,
      }}
    />
  );
}
