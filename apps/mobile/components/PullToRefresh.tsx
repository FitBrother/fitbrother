import { Platform, Text, View } from "react-native";
import type { ReactElement } from "react";
import WebPullToRefresh from "react-simple-pull-to-refresh";
import { LoadingDots } from "@/components/LoadingDots";

type Props = {
  onRefresh: () => void | Promise<unknown>;
  /**
   * Desliga o gesto. A Home usa isso para liberar o puxar-pra-atualizar apenas
   * com o resumo expandido — que é quando a lista está no topo. Colapsado, o
   * usuário está lendo refeições e o gesto só atrapalharia.
   */
  enabled?: boolean;
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
export function PullToRefresh({ onRefresh, enabled = true, children }: Props) {
  if (Platform.OS !== "web") return children;

  return (
    <WebPullToRefresh
      isPullable={enabled}
      onRefresh={async () => {
        await onRefresh();
      }}
      // Subir maxPullDownDistance foi o jeito errado de tornar o gesto mais
      // exigente — o CONTEÚDO em si passou a descer 240px na tela, visual
      // demais (e o indicador de "solte" ficava em opacidade máxima bem
      // antes de terminar de descer, já que o cálculo interno da lib é
      // fixo em 65px — daí a sensação de tremido/errado no resto do
      // arrasto). A distância visual agora fica modesta (perto do que apps
      // nativos fazem); quem segura a dificuldade é o resistance — precisa
      // arrastar bem mais fisicamente pra render a mesma distância na tela.
      pullDownThreshold={85}
      maxPullDownDistance={90}
      resistance={2.2}
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
