import { File, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { ExternalLink } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { Button } from "@/components/Button";
import { getAccountExport, setMarketingConsent } from "@/lib/api/account";
import { colors } from "@/lib/colors";
import { legalUrls } from "@/lib/legal";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { useToast } from "@/lib/toast/toast-context";

export default function PrivacyScreen() {
  const router = useRouter();
  const account = useAccountProfile();
  const toast = useToast();
  const marketing = account.data?.consents.marketing?.granted ?? false;
  const [consentBusy, setConsentBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  async function toggleMarketing(value: boolean) {
    setConsentBusy(true);
    try {
      await setMarketingConsent(value);
      await account.refetch();
      toast({ variant: "success", message: "Preferência atualizada" });
    } catch {
      toast({ variant: "error", message: "A preferência não foi alterada" });
    } finally {
      setConsentBusy(false);
    }
  }

  async function exportData() {
    setExportBusy(true);
    let file: File | null = null;
    try {
      const result = await getAccountExport();
      file = new File(Paths.cache, result.filename);
      file.create({ overwrite: true });
      file.write(result.bytes);
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        throw new Error("sharing_unavailable");
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/zip",
        dialogTitle: "Exportar dados do FitBrother",
      });
    } catch {
      toast({ variant: "error", message: "Não foi possível exportar os dados" });
    } finally {
      if (file?.exists) file.delete();
      setExportBusy(false);
    }
  }

  return (
    <AccountScreen title="Privacidade e dados">
      <AccountCard>
        <ConsentRow
          title="Termos de Uso"
          granted={account.data?.consents.terms?.granted}
          url={legalUrls.termsUrl}
        />
        <ConsentRow
          title="Política de Privacidade"
          granted={account.data?.consents.privacy?.granted}
          url={legalUrls.privacyUrl}
        />
        <ConsentRow
          title="Processamento por IA"
          description="Obrigatório: a IA é parte central do FitBrother."
          granted={account.data?.consents.ai_processing?.granted}
          url={legalUrls.privacyUrl}
        />
        <ConsentRow
          title="Dados de saúde"
          description="Obrigatório: peso, composição corporal e condições informadas."
          granted={account.data?.consents.health_data?.granted}
          url={legalUrls.privacyUrl}
        />
        <View className="mt-4 flex-row items-center border-t border-neutral-100 pt-4">
          <View className="flex-1 pr-3">
            <Text className="font-sans-semibold text-base text-neutral-900">Marketing</Text>
            <Text className="font-sans text-sm text-neutral-600">
              Novidades e comunicações opcionais.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Consentimento de marketing"
            disabled={consentBusy || !account.data}
            value={marketing}
            onValueChange={toggleMarketing}
            trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
            thumbColor={marketing ? colors.primary[700] : colors.neutral[50]}
          />
        </View>
      </AccountCard>
      <AccountCard>
        <Text className="font-sans-semibold text-base text-neutral-900">Seus dados</Text>
        <Text className="mb-4 mt-1 font-sans text-sm text-neutral-600">
          Baixe uma cópia em ZIP com os JSONs vinculados à sua conta.
        </Text>
        <Button
          label="Exportar meus dados"
          variant="outline"
          loading={exportBusy}
          onPress={exportData}
        />
      </AccountCard>
      <AccountCard>
        <Text className="font-sans-semibold text-base text-danger-600">Excluir conta</Text>
        <Text className="mb-4 mt-1 font-sans text-sm text-neutral-600">
          A conta fica bloqueada agora e pode ser reativada durante 30 dias.
        </Text>
        <Button
          label="Iniciar exclusão"
          variant="outline"
          onPress={() => router.push("/delete-account" as never)}
        />
      </AccountCard>
    </AccountScreen>
  );
}

function ConsentRow({
  title,
  description = "Obrigatório para usar o serviço.",
  granted,
  url,
}: {
  title: string;
  description?: string;
  granted?: boolean;
  url?: string;
}) {
  return (
    <View className="mb-4 flex-row items-start">
      <View className="flex-1">
        <Text className="font-sans-semibold text-base text-neutral-900">{title}</Text>
        <Text className="font-sans text-sm text-neutral-600">{description}</Text>
        {url && (
          <Pressable
            onPress={() => Linking.openURL(url)}
            accessibilityRole="link"
            accessibilityLabel={`Ler ${title}`}
            hitSlop={8}
            className="mt-1 min-h-[44px] flex-row items-center gap-1"
          >
            <Text className="font-sans-medium text-sm text-primary-700">Ler documento</Text>
            <ExternalLink size={14} color={colors.primary[700]} />
          </Pressable>
        )}
      </View>
      <Text className="font-sans-semibold text-sm text-primary-700">
        {granted ? "Aceito" : "Obrigatório"}
      </Text>
    </View>
  );
}
