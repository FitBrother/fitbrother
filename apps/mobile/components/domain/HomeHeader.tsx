import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { BarChart3, Home as HomeIcon, Rss } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { shadows } from "@/lib/shadows";
import { profileInitials } from "@/lib/account-utils";
import { useAvatarUrl } from "@/lib/hooks/useAvatarUrl";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useStreak } from "@/lib/hooks/useStreak";
import { useProfile } from "@/lib/profile/profile-context";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { Avatar } from "@/components/Avatar";

export type HomeTab = "home" | "feed" | "analises";

export const TABS: { key: HomeTab; label: string; Icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "feed", label: "Social", Icon: Rss },
  { key: "analises", label: "Análises", Icon: BarChart3 },
];

/** Padding interno da barra de abas, em px (equivale ao `p-[3px]`). */
const TAB_BAR_PADDING = 3;

/** Diâmetro do botão de perfil — casado com a altura do pill de ofensivas. */
export const AVATAR_SIZE = 50;

/** Altura de cada aba. Somada ao padding das pontas, fecha nos 50 dos vizinhos. */
const TAB_HEIGHT = AVATAR_SIZE - TAB_BAR_PADDING * 2;

/**
 * Largura de uma aba inativa. Quadrada, igual à altura: só o ícone cabe nela,
 * e 44×44 é exatamente o alvo de toque mínimo — sem precisar de hitSlop.
 */
const TAB_INACTIVE_WIDTH = TAB_HEIGHT;

/** Altura total da barra de abas, incluindo o padding das duas pontas. */
export function tabBarHeight(): number {
  return TAB_HEIGHT + TAB_BAR_PADDING * 2;
}

/**
 * Largura da aba ativa: o que sobra da barra depois do padding das pontas e
 * das inativas. As três abas deixaram de ter largura igual porque com o menu
 * na mesma linha da ofensiva e do perfil não cabem três rótulos — "Análises"
 * sozinho pede mais que o slot disponível num aparelho de 360px. Só a ativa
 * mostra rótulo, e ela fica com toda a sobra.
 *
 * Devolve 0 antes do primeiro onLayout, quando a largura ainda é desconhecida.
 */
export function activeTabWidth(barWidth: number, count: number, padding: number): number {
  const livre = barWidth - padding * 2 - TAB_INACTIVE_WIDTH * (count - 1);
  return Math.max(0, livre);
}

/**
 * Deslocamento horizontal da aba de índice `index`. Todas as abas antes da
 * ativa são inativas, então o passo é constante — o indicador só precisa
 * saber quantas ficaram para trás.
 */
export function tabOffset(index: number, padding: number): number {
  return padding + TAB_INACTIVE_WIDTH * index;
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({
  softMode = false,
  activeTab,
  onChangeTab,
}: {
  softMode?: boolean;
  activeTab: HomeTab;
  onChangeTab: (tab: HomeTab) => void;
}) {
  const router = useRouter();
  const { data: streakView } = useStreak();
  const profile = useProfile();
  const session = useAuthSession();
  const email = session.status === "signed_in" ? (session.session.user.email ?? null) : null;
  const initials = profileInitials(profile.full_name, email);
  const avatarUrl = useAvatarUrl(profile.avatar_url);

  // Indicador da aba ativa. Como a ativa é mais larga que as inativas, ele
  // anima largura E posição — antes, com slots iguais, bastava o translateX.
  const [barWidth, setBarWidth] = useState(0);
  const largura = activeTabWidth(barWidth, TABS.length, TAB_BAR_PADDING);
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab),
  );
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const destinoX = tabOffset(activeIndex, TAB_BAR_PADDING);
    const opcoes = { duration: Motion.duration.base, easing: Motion.easing.standard };
    indicatorX.value = reducedMotion ? destinoX : withTiming(destinoX, opcoes);
    indicatorW.value = reducedMotion ? largura : withTiming(largura, opcoes);
  }, [activeIndex, largura, indicatorX, indicatorW, reducedMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  return (
    // Sem padding inferior: quem define o respiro até o dashboard é o `pt-2`
    // do painel de macros, para o gap não sair da soma de dois paddings.
    <View className="flex-row items-center gap-2 px-4 pt-2 lg:hidden">
      {!softMode && streakView ? (
        <Pressable
          onPress={() => router.push("/(app)/history" as never)}
          accessibilityRole="button"
          accessibilityLabel="Ver histórico de ofensivas"
          style={shadows.floating}
          className="rounded-full bg-white px-2.5 active:opacity-70"
        >
          {/* Chama e número no mesmo corpo (18): o número maior que o ícone
              criava uma hierarquia de número-herói que competia com o avatar
              e com a barra ao lado. */}
          <StreakCounter
            current={streakView.streak.current_streak}
            atRisk={streakView.atRisk}
            size={18}
            height={AVATAR_SIZE}
          />
        </Pressable>
      ) : null}

      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={shadows.floating}
        className="flex-1 flex-row rounded-full bg-white p-[3px]"
      >
        {/* Estilo inline: o NativeWind não processa className em componentes
            do Reanimated. */}
        {largura > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: TAB_BAR_PADDING,
                bottom: TAB_BAR_PADDING,
                left: 0,
                borderRadius: 9999,
                backgroundColor: colors.primary[400],
              },
              indicatorStyle,
            ]}
          />
        )}
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <Pressable
              key={key}
              onPress={() => onChangeTab(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={{
                height: TAB_HEIGHT,
                width: active ? undefined : TAB_INACTIVE_WIDTH,
                flex: active ? 1 : undefined,
              }}
              className="flex-row items-center justify-center gap-1.5 rounded-full active:opacity-70"
            >
              <Icon
                size={active ? 16 : 18}
                color={active ? colors.neutral[900] : colors.neutral[400]}
              />
              {/* Só a ativa mostra rótulo. O accessibilityLabel do Pressable
                  mantém o nome disponível para leitores de tela nas inativas. */}
              {active && <Text className="font-sans-bold text-xs text-neutral-900">{label}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push("/(app)/profile" as never)}
        accessibilityLabel="Perfil"
        accessibilityRole="button"
      >
        {/* O wrapper carrega a sombra e repete o fundo do Avatar porque o
            `elevation` do Android não desenha sombra em View transparente. */}
        <View style={shadows.floating} className="rounded-full bg-primary-100">
          <Avatar uri={avatarUrl} initials={initials} size={AVATAR_SIZE} />
        </View>
      </Pressable>
    </View>
  );
}
