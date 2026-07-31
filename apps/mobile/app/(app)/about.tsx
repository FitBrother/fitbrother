import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { ExternalLink } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { colors } from "@/lib/colors";

const legal = Constants.expoConfig?.extra?.legal as
  | { termsUrl?: string; privacyUrl?: string }
  | undefined;

export default function AboutScreen() {
  return (
    <AccountScreen title="Sobre">
      <AccountCard>
        <Text className="font-display-bold text-2xl text-neutral-900">FitBrother</Text>
        <Text className="mt-1 font-sans text-sm text-neutral-600">
          Versão {Constants.expoConfig?.version ?? "—"}
        </Text>
      </AccountCard>
      <AccountCard>
        <LegalLink label="Termos de Uso" url={legal?.termsUrl} />
        <LegalLink label="Política de Privacidade" url={legal?.privacyUrl} />
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
