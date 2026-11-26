import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeSkeleton } from "@/components/domain/HomeSkeleton";
import { ScreenFade } from "@/components/ScreenFade";
import { Sidebar } from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useAchievementsRealtime } from "@/lib/hooks/useAchievementsRealtime";
import { useSubscriptionRealtime } from "@/lib/hooks/useSubscription";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { colors } from "@/lib/colors";
import { TourProvider } from "@/lib/tour/tour-context";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { ConfirmMealBackground, ConfirmMealHost } from "@/lib/confirm-meal/confirm-meal-context";

const SHEET_BG = colors.neutral[50];

function GuardedStack() {
  const state = useProfileState();
  const router = useRouter();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;

  // In-app conquista toast (instant, via Realtime).
  useAchievementsRealtime(userId);
  useSubscriptionRealtime(userId);

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
      <ConfirmMealBackground className="flex-1 lg:flex-row">
        <Sidebar />
        <ScreenFade>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            {/* Compartilhar é tela comum, sem `presentation`: um modal nativo
                cobriria o ConfirmDialog e os toasts, que moram na raiz (o Modal
                do RN apresenta a partir do VC raiz, que já está apresentando o
                modal da tela), e no iOS a pergunta nunca apareceria. Sem o
                gesto de voltar porque arrastar da borda brigaria com o
                arrasto de foto e sticker. */}
            <Stack.Screen
              name="share/[type]/[id]"
              options={{ animation: "slide_from_bottom", gestureEnabled: false }}
            />
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
      </ConfirmMealBackground>
      <ConfirmMealHost />
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
