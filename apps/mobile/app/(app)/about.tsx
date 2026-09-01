import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { ExternalLink } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { Logo } from "@/components/Logo";
import { colors } from "@/lib/colors";
import { legalUrls } from "@/lib/legal";

export default function AboutScreen() {
  return (
    <AccountScreen title="Sobre">
      <AccountCard>
        <Logo height={26} />
        <Text className="mt-2 font-sans text-sm text-neutral-600">
          Versão {Constants.expoConfig?.version ?? "—"}
        </Text>
      </AccountCard>
      <AccountCard>
        <LegalLink label="Termos de Uso" url={legalUrls.termsUrl} />
        <LegalLink label="Política de Privacidade" url={legalUrls.privacyUrl} />
        <LegalLink label="Aviso sobre Saúde e IA" url={legalUrls.healthUrl} />
        <LegalLink label="Exclusão de conta e dados" url={legalUrls.deletionUrl} />
        <LegalLink label="Política de Cookies" url={legalUrls.cookiesUrl} />
      </AccountCard>
    </AccountScreen>
  );
}

function LegalLink({ label, url }: { label: string; url?: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${label}`}
      disabled={!url}
      onPress={() => url && Linking.openURL(url)}
      className="min-h-[52px] flex-row items-center justify-between"
    >
      <Text className="font-sans-medium text-base text-neutral-900">{label}</Text>
      <ExternalLink size={19} color={colors.primary[700]} />
    </Pressable>
  );
}
