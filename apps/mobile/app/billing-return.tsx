import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CircleCheck, CircleX } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { subscriptionKey } from "@/lib/hooks/useSubscription";

export default function BillingReturn() {
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const cancelled = status === "cancel";

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
          {cancelled
            ? "Assinatura não concluída. Você pode tentar de novo pelo seu perfil."
            : "Pagamento recebido. Você já pode fechar esta janela e voltar ao app."}
        </Text>
        <View className="mt-8 w-full">
          <Button label="Continuar" variant="outline" onPress={() => router.replace("/")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
