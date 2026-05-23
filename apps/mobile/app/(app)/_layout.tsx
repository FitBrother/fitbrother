import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";

function GuardedStack() {
  const state = useProfileState();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }
  if (state.status === "missing") {
    return <Redirect href="/(onboarding)" />;
  }
  if (state.status === "error") {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  return (
    <ProfileProvider>
      <GuardedStack />
    </ProfileProvider>
  );
}
