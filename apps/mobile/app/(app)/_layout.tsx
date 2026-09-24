import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeSkeleton } from "@/components/domain/HomeSkeleton";
import { ScreenFade } from "@/components/ScreenFade";
import { Sidebar } from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useAchievementsRealtime } from "@/lib/hooks/useAchievementsRealtime";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { colors } from "@/lib/colors";
import { TourProvider } from "@/lib/tour/tour-context";
import { TourOverlay } from "@/components/tour/TourOverlay";

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
    // Mesmo raciocínio do gate em app/index.tsx: usar o skeleton da Home (o
    // destino padrão desta stack) em vez de uma casca genérica, pra não
    // trocar de formato de skeleton assim que a Home montar.
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }
  if (state.status === "missing") {
    return <Redirect href="/(onboarding)" />;
  }
  if (state.status === "error") {
    return <Redirect href="/" />;
  }

  return (
    <TourProvider>
      {/* Linha só a partir de `lg`, casando com o breakpoint da Sidebar: abaixo
          disso ela não existe e a coluna é o layout do mobile. */}
      <View className="flex-1 lg:flex-row">
        <Sidebar />
        <ScreenFade>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
            {/* Compartilhar é tarefa de ida e volta, não um lugar do app: sobe
                como modal para que voltar seja o gesto de fechar, e não o de
                desfazer a navegação. (Na web o expo-router ignora e empilha
                normalmente.) */}
            <Stack.Screen name="share/[type]/[id]" options={{ presentation: "modal" }} />
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
      <TourOverlay />
    </TourProvider>
  );
}

export default function AppLayout() {
  return (
    <ProfileProvider>
      <GuardedStack />
    </ProfileProvider>
  );
}
