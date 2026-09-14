import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { ScreenFade } from "@/components/ScreenFade";
import { Sidebar } from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useAchievementsRealtime } from "@/lib/hooks/useAchievementsRealtime";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { colors } from "@/lib/colors";

const SHEET_BG = colors.neutral[50];

function GuardedStack() {
  const state = useProfileState();
  const router = useRouter();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;

  // In-app conquista toast (instant, via Realtime).
  useAchievementsRealtime(userId);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/(auth)/welcome");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Ask for push permission + register the token once the user reaches the app
  // (i.e. right after onboarding, and on every subsequent launch). Idempotent.
  useEffect(() => {
    if (state.status === "ready") {
      void registerForPushNotificationsAsync();
    }
  }, [state.status]);

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
    // Linha só a partir de `lg`, casando com o breakpoint da Sidebar: abaixo
    // disso ela não existe e a coluna é o layout do mobile.
    <View className="flex-1 lg:flex-row">
      <Sidebar />
      <ScreenFade>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="history/[day]/new"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetCornerRadius: 24,
              contentStyle: { backgroundColor: SHEET_BG },
              gestureEnabled: false,
            }}
          />
        </Stack>
      </ScreenFade>
    </View>
  );
}

export default function AppLayout() {
  return (
    <ProfileProvider>
      <GuardedStack />
    </ProfileProvider>
  );
}
