import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountDeletionPendingError, getMe } from "@/lib/api";
import { colors } from "@/lib/colors";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

type ProfileState =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "present" }
  | { kind: "deletion_pending" }
  | { kind: "error"; message: string };

export default function Index() {
  const auth = useAuthSession();
  const [profile, setProfile] = useState<ProfileState>({ kind: "checking" });

  const fetchMe = useCallback(async (signal: { cancelled: boolean }) => {
    setProfile({ kind: "checking" });
    try {
      const me = await getMe();
      if (signal.cancelled) return;
      setProfile({ kind: me ? "present" : "missing" });
    } catch (e) {
      if (signal.cancelled) return;
      if (e instanceof AccountDeletionPendingError) {
        setProfile({ kind: "deletion_pending" });
        return;
      }
      // Don't redirect to onboarding on network/500 — the user may have
      // already completed it. Surface the error and let them retry.
      const message = e instanceof Error ? e.message : "Falha ao carregar perfil";
      setProfile({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "signed_in") {
      setProfile({ kind: "checking" });
      return;
    }
    const signal = { cancelled: false };
    void fetchMe(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [auth.status, fetchMe]);

  if (auth.status === "loading" || (auth.status === "signed_in" && profile.kind === "checking")) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </SafeAreaView>
    );
  }

  if (auth.status === "signed_out") {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile.kind === "missing") {
    return <Redirect href="/(onboarding)" />;
  }

  if (profile.kind === "deletion_pending") {
    return <Redirect href={"/account-reactivation" as never} />;
  }

  if (profile.kind === "error") {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50">
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Text className="text-2xl font-sans-extrabold text-neutral-800">Algo deu errado</Text>
          <Text className="text-center text-sm font-sans text-neutral-600">{profile.message}</Text>
          <Pressable
            onPress={() => fetchMe({ cancelled: false })}
            className="mt-2 h-12 items-center justify-center rounded-full bg-primary-400 px-6 active:bg-primary-500"
          >
            <Text className="text-base font-sans-semibold text-white">Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // profile.kind === "present"
  return <Redirect href="/(app)" />;
}
