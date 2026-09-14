import { Pressable, Text, View } from "react-native";
import { Check, Flame } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { profileInitials } from "@/lib/account-utils";

type LeaderboardRowProps = {
  userId: string;
  position: number;
  fullName: string | null;
  windowStreak: number;
  weeklyHits: number;
  isMe: boolean;
};

/**
 * Uma linha do ranking, para viver DENTRO do card do bloco (`ListBlock`).
 *
 * Não é mais um card por conta própria: seis cards empilhados, um por pessoa,
 * faziam o ranking parecer seis coisas separadas em vez de uma lista ordenada
 * — e a repetição de sombra a cada 64px pesava a tela inteira. Agora a sombra
 * é do bloco e as pessoas se separam por um filete.
 *
 * Toda linha leva ao perfil público, inclusive a sua — é o mesmo destino que
 * "Ver perfil público" em `/profile`, e num ranking o gesto de tocar no próprio
 * nome para comparar com os outros é o mais esperado que existe.
 */
export function LeaderboardRow({
  userId,
  position,
  fullName,
  windowStreak,
  weeklyHits,
  isMe,
}: LeaderboardRowProps) {
  const router = useRouter();
  const nome = isMe ? "você" : (fullName ?? "amigo");

  return (
    <Pressable
      onPress={() => router.push(`/(app)/users/${userId}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`Posição ${position}, ${nome}, ofensiva de ${windowStreak} dias, ${weeklyHits} dias na meta. Ver perfil`}
      // Destaque do "Você" vai de ponta a ponta do card, sem raio próprio: uma
      // faixa preenchida dentro da lista. Com cantos arredondados ele voltaria
      // a parecer um card solto de novo, que é o que saímos de.
      //
      // O feedback de toque dele é opacidade, não troca de fundo: `bg-neutral-50`
      // por cima da faixa menta apagaria o destaque justo no momento do toque.
      className={`flex-row items-center px-4 py-3 ${
        isMe ? "bg-primary-50 active:opacity-70" : "active:bg-neutral-50"
      }`}
    >
      <Text
        className="w-8 font-sans-bold text-sm text-neutral-500"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        #{position}
      </Text>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-200">
        <Text className="font-sans-semibold text-sm text-neutral-700">
          {profileInitials(fullName, null)}
        </Text>
      </View>
      <Text className="ml-3 flex-1 font-sans-semibold text-base text-neutral-800" numberOfLines={1}>
        {isMe ? "Você" : (fullName ?? "Amigo")}
      </Text>
      {/* Duas colunas de largura fixa para os números alinharem verticalmente
          entre as linhas — com largura automática, "10" empurrava a coluna e o
          ranking ficava serrilhado. O que cada uma conta está escrito uma vez
          na legenda acima da lista (`LeaderboardLegend`), não repetido em toda
          linha: seis vezes "ofensiva / na meta" é ruído, e era o que fazia os
          nomes truncarem em "Bruno Tava...". */}
      <View className="ml-2 w-10 flex-row items-center justify-end gap-1">
        <Flame size={16} color={colors.streak[400]} />
        <Text
          className="font-sans-semibold text-sm text-neutral-700"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {windowStreak}
        </Text>
      </View>
      <View className="w-10 flex-row items-center justify-end gap-1">
        {/* Ícone do DS, não o caractere "✓": o glifo de texto renderiza com a
            métrica da fonte e não alinha com o Flame ao lado. */}
        <Check size={16} color={colors.success[600]} />
        <Text
          className="font-sans-semibold text-sm text-neutral-700"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {weeklyHits}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Legenda das duas colunas de números do ranking.
 *
 * Fica acima da lista e nomeia o que os ícones contam. Sem ela o ranking
 * mostrava "🔥 2  ✓ 5" sem nada em lugar nenhum da tela explicando as duas
 * unidades — quem abre a aba pela primeira vez não tem como deduzir.
 */
export function LeaderboardLegend() {
  return (
    <View className="flex-row items-center gap-4 px-3">
      <View className="flex-row items-center gap-1">
        <Flame size={13} color={colors.streak[400]} />
        <Text className="font-sans text-xs text-neutral-500">dias de ofensiva</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Check size={13} color={colors.success[600]} />
        <Text className="font-sans text-xs text-neutral-500">dias na meta</Text>
      </View>
    </View>
  );
}
