import { useEffect } from "react";
import { Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppShellSkeleton } from "@/components/AppShellSkeleton";

/**
 * Alvo do redirectTo do login OAuth (Google/Apple). No nativo, o próprio SO
 * intercepta o deep link antes de o app navegar aqui — essa tela só é
 * alcançada de fato na web, onde expo-web-browser abre o login num popup e
 * depende de maybeCompleteAuthSession() rodando na página de retorno pra
 * mandar a URL final de volta pra janela que abriu o popup (via postMessage).
 * Sem isso, o popup fica parado na URL de retorno e o login nunca resolve.
 */
export default function AuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View className="flex-1">
      <AppShellSkeleton />
      <Text className="absolute inset-x-0 bottom-10 text-center font-sans text-sm text-neutral-500">
        Concluindo login...
      </Text>
    </View>
  );
}
