import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { getAccountExport, getDeletionState, reactivateAccount } from "@/lib/api/account";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

export default function AccountReactivationScreen() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<Awaited<ReturnType<typeof getDeletionState>> | null>(null);

  useEffect(() => {
    void getDeletionState()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  async function reactivate() {
    setBusy(true);
    try {
      const state = await getDeletionState();
      if (!state.can_reactivate) throw new Error("account_reactivation_expired");
      await reactivateAccount();
      await registerForPushNotificationsAsync();
      router.replace("/");
    } catch {
      toast({ variant: "error", message: "O prazo de reativação expirou ou ocorreu uma falha" });
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    let file: File | null = null;
    try {
      const result = await getAccountExport();
      file = new File(Paths.cache, result.filename);
      file.create({ overwrite: true });
      file.write(result.bytes);
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) throw new Error();
      await Sharing.shareAsync(file.uri, { mimeType: "application/zip" });
    } catch {
      toast({ variant: "error", message: "Não foi possível exportar os dados" });
    } finally {
      if (file?.exists) file.delete();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas px-5 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-1 justify-center">
        <Text className="font-display-bold text-3xl text-neutral-900">
          Sua conta está em exclusão
        </Text>
        <Text className="mt-3 font-sans text-base text-neutral-600">
          Reative agora para voltar a usar o FitBrother. Se não fizer nada, seus dados serão
          apagados ao final do prazo de 30 dias.
        </Text>
        {state?.scheduled_purge_at ? (
          <Text className="mt-3 font-sans-semibold text-sm text-neutral-800">
            Exclusão prevista para{" "}
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
              new Date(state.scheduled_purge_at),
            )}
          </Text>
        ) : null}
        <View className="mt-8 gap-3">
          {state?.can_reactivate !== false ? (
            <Button label="Reativar minha conta" loading={busy} onPress={reactivate} />
          ) : (
            <Text className="font-sans-semibold text-danger-600">
              O prazo de reativação expirou.
            </Text>
          )}
          <Button label="Exportar meus dados" variant="outline" onPress={exportData} />
          <Button
            label="Sair"
            variant="ghost"
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/(auth)/welcome");
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
