import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";
import { colors } from "@/lib/colors";

function GuardedStack() {
  const state = useProfileState();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/(auth)/welcome");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </View>
    );
  }
  if (state.status === "missing") {
    return <Redirect href="/(onboarding)" />;
  }
  if (state.status === "error") {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
      <Stack.Screen
        name="history/[day]/new"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: 24,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}

export default function AppLayout() {
  return (
    <ProfileProvider>
      <GuardedStack />
    </ProfileProvider>
  );
}
