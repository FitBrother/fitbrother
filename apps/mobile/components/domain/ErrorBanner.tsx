import { Pressable, Text, View } from "react-native";
import { AlertTriangle, WifiOff, X, Zap } from "lucide-react-native";
import { colors } from "@/lib/colors";

export type ErrorBannerVariant =
  | "quota_exceeded"
  | "offline"
  | "server_error"
  | "network"
  | "backfill_window_exceeded";

type Props = {
  variant: ErrorBannerVariant;
  onDismiss: () => void;
};

const COPY: Record<ErrorBannerVariant, { title: string; body: string }> = {
  quota_exceeded: {
    title: "Limite diário de IA atingido",
    body: "Você pode voltar amanhã ou adicionar manualmente (em breve).",
  },
  offline: {
    title: "Sem conexão",
    body: "Verifique sua internet e tente novamente.",
  },
  server_error: {
    title: "Algo deu errado",
    body: "Tente novamente em instantes.",
  },
  network: {
    title: "Erro de rede",
    body: "Sua refeição não foi salva. Tente de novo.",
  },
  backfill_window_exceeded: {
    title: "Janela expirada",
    body: "Só é possível registrar refeições dos últimos 7 dias. Atualize o histórico.",
  },
};

export function ErrorBanner({ variant, onDismiss }: Props) {
  const { title, body } = COPY[variant];
  const Icon = variant === "quota_exceeded" ? Zap : variant === "offline" ? WifiOff : AlertTriangle;
  return (
    <View className="mx-4 mt-2 flex-row items-start gap-3 rounded-2xl bg-warning-50 p-4">
      <Icon size={20} color={colors.warning[500]} />
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-neutral-800">{title}</Text>
        <Text className="mt-0.5 text-sm font-sans text-neutral-600">{body}</Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityLabel="Fechar aviso"
        accessibilityRole="button"
        className="min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <X size={18} color={colors.neutral[500]} />
      </Pressable>
    </View>
  );
}
