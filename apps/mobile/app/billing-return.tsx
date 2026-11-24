import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CircleCheck, CircleX } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { billingReturnState } from "@/lib/billing-return";
import { subscriptionKey } from "@/lib/hooks/useSubscription";

const MESSAGES = {
  success: "Pagamento recebido. Estamos ativando seu plano.",
  cancel: "Assinatura não concluída. Você pode tentar de novo pelo seu perfil.",
  neutral: "Tudo certo. Você já pode voltar ao app.",
} as const;

export default function BillingReturn() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ status?: string; session_id?: string }>();
  const state = billingReturnState(params);
  const cancelled = state === "cancel";

  useEffect(() => {
    try {
      void qc.invalidateQueries({ queryKey: subscriptionKey });
    } catch {
      // signed out on web: nothing to refresh
    }
  }, [qc]);

  const Icon = cancelled ? CircleX : CircleCheck;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 items-center justify-center px-6">
        <Icon size={48} color={cancelled ? colors.neutral[400] : colors.primary[700]} />
        <Text className="mt-4 text-center font-sans-medium text-base text-neutral-900">
          {MESSAGES[state]}
        </Text>
        <View className="mt-8 w-full">
          <Button label="Continuar" variant="outline" onPress={() => router.replace("/")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
