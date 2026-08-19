import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/colors";
import { Button } from "@/components/Button";
import { getAccountExport } from "@/lib/api/account";
import { useDeleteAccount } from "@/lib/hooks/useDeleteAccount";
import { apiBaseUrl } from "@/lib/dev-host";

export default function PrivacyScreen() {
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      // Confirma que o endpoint responde OK antes de baixar (reaproveita a
      // mesma lógica de auth/erro de getAccountExport), depois usa
      // downloadAsync direto pra não duplicar a leitura do stream em memória.
      await getAccountExport();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("not_authenticated");

      const cacheDir = FileSystem.cacheDirectory ?? "";
      const dest = `${cacheDir}fitbrother-dados.zip`;
      const result = await FileSystem.downloadAsync(`${apiBaseUrl()}/account/export`, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status !== 200) throw new Error(`account_export_failed_${result.status}`);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("sharing_unavailable");
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/zip",
        dialogTitle: "Exportar meus dados",
      });
    } catch (err) {
      Alert.alert(
        "Não foi possível exportar",
        err instanceof Error ? err.message : "Tente novamente em instantes.",
      );
    } finally {
      setExporting(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Excluir conta?",
      "Sua conta será desativada e vai sumir das telas sociais. Você pode reativar fazendo login de novo dentro do prazo — depois disso, os dados são apagados de vez.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir conta",
          style: "destructive",
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                await supabase.auth.signOut();
                router.replace("/(auth)/welcome" as never);
              },
              onError: (err) => Alert.alert("Não foi possível excluir", err.message),
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Dados e privacidade</Text>
      </View>

      <View className="gap-4 px-5 pt-4">
        <Button
          label="Exportar meus dados"
          variant="outline"
          loading={exporting}
          onPress={() => void handleExport()}
        />
        {exporting && <ActivityIndicator color={colors.primary[400]} />}
        <Button
          label="Excluir conta"
          variant="danger"
          loading={deleteAccount.isPending}
          onPress={handleDelete}
        />
      </View>
    </SafeAreaView>
  );
}
