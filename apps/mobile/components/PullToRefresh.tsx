import { Platform, Text, View } from "react-native";
import type { ReactElement } from "react";
import WebPullToRefresh from "react-simple-pull-to-refresh";
import { LoadingDots } from "@/components/LoadingDots";

type Props = {
  onRefresh: () => void | Promise<unknown>;
  children: ReactElement;
};

/**
 * O RefreshControl do react-native-web é um stub — confirmado lendo o
 * código-fonte da própria lib instalada, ele só faz `return
 * React.createElement(View, rest)`, sem nenhum gesto, nunca chama
 * onRefresh. Puxar pra atualizar nunca funcionou de verdade na web/PWA,
 * em nenhuma tela, mesmo antes de qualquer coisa que a gente tenha
 * mexido aqui.
 *
 * No nativo o RefreshControl de cada tela já resolve isso sozinho (esse
 * wrapper só entra ativo na web) — daí embrulhar só o FlatList/ScrollView,
 * não a tela toda: o cabeçalho fica fixo, só o conteúdo scrollável puxa,
 * igual ao comportamento nativo.
 */
export function PullToRefresh({ onRefresh, children }: Props) {
  if (Platform.OS !== "web") return children;

  return (
    <WebPullToRefresh
      onRefresh={async () => {
        await onRefresh();
      }}
      pullingContent={
        <View className="items-center py-3">
          <Text className="font-sans-medium text-sm text-neutral-500">Solte para atualizar</Text>
        </View>
      }
      refreshingContent={
        <View className="items-center py-3">
          <LoadingDots />
        </View>
      }
    >
      {children}
    </WebPullToRefresh>
  );
}
