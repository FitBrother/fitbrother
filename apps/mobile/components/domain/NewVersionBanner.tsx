import { Pressable, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { useNewVersionAvailable } from "@/lib/hooks/useNewVersionAvailable";
import { reloadApp } from "@/lib/reload-app";

/**
 * Aviso sutil (não um reload forçado) de que já existe uma versão nova
 * publicada — o usuário decide quando recarregar, em vez de levar o
 * surpreendido no meio de uma sessão. Só aparece na web (useNewVersionAvailable
 * é sempre `false` no nativo).
 */
export function NewVersionBanner({ className = "" }: { className?: string }) {
  const available = useNewVersionAvailable();
  if (!available) return null;

  return (
    <Pressable
      onPress={reloadApp}
      accessibilityRole="button"
      accessibilityLabel="Nova versão disponível. Toque para atualizar."
      className={`min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 ${className}`}
    >
      <RefreshCw size={20} color={colors.primary[500]} />
      <View className="flex-1">
        <Text className="font-sans-semibold text-sm text-neutral-800">Nova versão disponível</Text>
        <Text className="font-sans text-sm text-neutral-600">Toque para atualizar</Text>
      </View>
    </Pressable>
  );
}
