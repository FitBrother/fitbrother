import { useEffect, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
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

/**
 * Diâmetro do botão de perfil — casado com a altura do pill de ofensivas.
 * 52 é a altura de controle do app: `button-height` e `input-height` no
 * tailwind.config, o Button `md` e o Input. A linha do header fecha nela em vez
 * de ter um número próprio.
 */
export const AVATAR_SIZE = 52;

/** Altura de cada aba. Somada ao padding das pontas, fecha nos 52 dos vizinhos. */
const TAB_HEIGHT = AVATAR_SIZE - TAB_BAR_PADDING * 2;

/**
 * Largura de uma aba inativa. Quadrada, igual à altura: só o ícone cabe nela,
 * e 46×46 passa com folga do alvo de toque mínimo de 44 — sem precisar de
 * hitSlop.
 */
const TAB_INACTIVE_WIDTH = TAB_HEIGHT;

/** Altura total da barra de abas, incluindo o padding das duas pontas. */
export function tabBarHeight(): number {
  return TAB_HEIGHT + TAB_BAR_PADDING * 2;
}

/**
 * A partir desta largura de janela a barra comporta os três rótulos ao mesmo
 * tempo. É o breakpoint `md` do Tailwind — o mesmo ponto em que as telas já
 * passam a centralizar conteúdo.
 */
export const WIDE_TABS_MIN_WIDTH = 768;

/**
 * Como as abas se distribuem na barra.
 *
 * `compact` — só a ativa mostra rótulo e fica com toda a sobra; as inativas
 * viram quadrados de 44 (o alvo de toque mínimo). É o aperto do celular: com o
 * menu na mesma linha da ofensiva e do perfil, "Análises" sozinho já pede mais
 * que o terço disponível num aparelho de 360px.
 *
 * `wide` — sobra largura, então as três abas têm o mesmo tamanho e todas
 * mostram o rótulo.
 */
export type TabLayout = "compact" | "wide";

export function tabLayoutFor(windowWidth: number): TabLayout {
  return windowWidth >= WIDE_TABS_MIN_WIDTH ? "wide" : "compact";
}

/**
 * Largura da aba ativa no layout `compact`: o que sobra da barra depois do
 * padding das pontas e das inativas.
 *
 * Devolve 0 antes do primeiro onLayout, quando a largura ainda é desconhecida.
 */
export function activeTabWidth(barWidth: number, count: number, padding: number): number {
  const livre = barWidth - padding * 2 - TAB_INACTIVE_WIDTH * (count - 1);
  return Math.max(0, livre);
}

/**
 * Largura de cada aba no layout `wide`: a barra dividida em partes iguais.
 * Como todas mostram rótulo, nenhuma tem motivo para ser mais estreita.
 */
export function evenTabWidth(barWidth: number, count: number, padding: number): number {
  return Math.max(0, (barWidth - padding * 2) / count);
}

/**
 * Deslocamento horizontal da aba de índice `index`. O passo é constante — o
 * indicador só precisa saber quantas abas ficaram para trás e quanto cada uma
 * ocupa. Em `compact` todas as anteriores são inativas (o padrão); em `wide`
 * todas medem o mesmo, e o chamador passa essa largura.
 */
export function tabOffset(
  index: number,
  padding: number,
  stepWidth: number = TAB_INACTIVE_WIDTH,
): number {
  return padding + stepWidth * index;
}

/** Corpo do ícone em cada estado. O inativo é maior porque perde o rótulo. */
const TAB_ICON_INACTIVE = 18;
const TAB_ICON_ACTIVE = 16;
/**
 * O ícone é desenhado uma vez no corpo maior e encolhe por `scale`. Animar a
 * prop `size` remontaria o SVG a cada frame; `scale` só compõe.
 */
const TAB_ICON_SCALE = TAB_ICON_ACTIVE / TAB_ICON_INACTIVE;

/** Respiro entre ícone e rótulo, em px (o antigo `gap-1.5`). */
const TAB_GAP = 6;

/**
 * Escala do ícone em função do progresso (0 = inativa, 1 = ativa).
 *
 * Vai de 1 (corpo cheio, 18) a 16/18. A aba inativa perde o rótulo, então o
 * ícone cresce para não ficar pequeno sozinho no quadrado.
 */
export function tabIconScale(progress: number): number {
  "worklet";
  return 1 - progress * (1 - TAB_ICON_SCALE);
}

/**
 * Quanto o ícone anda para a direita, em px.
 *
 * O conteúdo (ícone + respiro + rótulo) é centralizado na aba. Quando o rótulo
 * some, o centro visual do que sobra fica deslocado à esquerda por metade do
 * que o rótulo ocupava — este valor devolve o ícone ao centro da aba.
 */
export function tabIconShift(progress: number, labelWidth: number): number {
  "worklet";
  return ((1 - progress) * (TAB_GAP + labelWidth)) / 2;
}

/**
 * Estilo do rótulo por `style`, não por className: o NativeWind não processa
 * className em componentes do Reanimated — a prop é aceita e ignorada, e o
 * texto sairia sem fonte nem cor. `flexShrink: 0` porque a aba inativa é mais
 * estreita que ícone + rótulo: sem isso o texto seria espremido em vez de
 * transbordar, e o recorte deixaria de ser previsível.
 */
const TAB_LABEL_BASE = {
  fontSize: 12,
  lineHeight: 16,
  marginLeft: TAB_GAP,
  flexShrink: 0,
} as const;

const TAB_LABEL_ACTIVE = { fontFamily: "Inter_700Bold", color: colors.neutral[900] } as const;
const TAB_LABEL_INACTIVE = { fontFamily: "Inter_500Medium", color: colors.neutral[400] } as const;

/**
 * Uma aba da barra de navegação.
 *
 * O conteúdo fica SEMPRE montado na configuração ativa — ícone, respiro e
 * rótulo em largura natural — e os dois estados são só transform sobre esse
 * layout fixo. Isso é o que permite animar sem relayout por frame:
 *
 * - inativa: o rótulo vai a `scale` 0 (some) e o ícone anda para a direita,
 *   ocupando o centro que o rótulo desocupou;
 * - ativa: o inverso, e o ícone encolhe para abrir espaço ao texto.
 *
 * O deslocamento do ícone é metade de `respiro + largura do rótulo` porque o
 * conteúdo é centralizado: tirar o rótulo do desenho move o centro visual
 * exatamente essa distância. A largura vem do `onLayout` do próprio texto, que
 * mede a largura natural em qualquer estado — `scale` não mexe no layout.
 *
 * A largura da aba também anima. Sem isso o indicador deslizaria enquanto a
 * caixa por baixo dele salta, e o ícone perseguiria um centro que muda de
 * lugar de um frame para o outro.
 */
function Tab({
  label,
  Icon,
  active,
  wide,
  width,
  onPress,
}: {
  label: string;
  Icon: typeof HomeIcon;
  active: boolean;
  wide: boolean;
  width: number;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [labelWidth, setLabelWidth] = useState(0);
  // 1 = ativa. No modo `wide` todas mostram rótulo e ícone pequeno, então não
  // há o que animar — o valor fica fixo em 1 e as abas só trocam de cor.
  const progresso = useSharedValue(active || wide ? 1 : 0);
  const largura = useSharedValue(width);

  useEffect(() => {
    const destino = active || wide ? 1 : 0;
    progresso.value = reducedMotion
      ? destino
      : withTiming(destino, {
          duration: Motion.duration.base,
          easing: Motion.easing.standard,
        });
  }, [active, wide, progresso, reducedMotion]);

  useEffect(() => {
    largura.value = reducedMotion
      ? width
      : withTiming(width, { duration: Motion.duration.base, easing: Motion.easing.standard });
  }, [width, largura, reducedMotion]);

  const containerStyle = useAnimatedStyle(() => ({ width: largura.value }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tabIconShift(progresso.value, labelWidth) },
      { scale: tabIconScale(progresso.value) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [{ scale: progresso.value }],
  }));

  /** Estado em que o rótulo não aparece na tela: `compact` e aba inativa. */
  const oculto = !wide && !active;

  return (
    <Animated.View style={[{ height: TAB_HEIGHT, overflow: "hidden" }, containerStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        className="flex-1 flex-row items-center justify-center rounded-full active:opacity-70"
      >
        <Animated.View style={iconStyle}>
          <Icon
            size={TAB_ICON_INACTIVE}
            color={active ? colors.neutral[900] : colors.neutral[400]}
          />
        </Animated.View>
        {/* Montado sempre, inclusive na aba inativa: é a largura natural dele
            que diz ao ícone quanto andar, e ela só é mensurável em layout.
            Como não desmonta mais, precisa sair da árvore de acessibilidade
            justamente quando some da tela — texto invisível que continua
            anunciável é pior que texto ausente. O nome da aba não se perde: o
            Pressable carrega o `accessibilityLabel`. */}
        <Animated.Text
          onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
          accessibilityElementsHidden={oculto}
          importantForAccessibility={oculto ? "no-hide-descendants" : "auto"}
          numberOfLines={1}
          style={[TAB_LABEL_BASE, active ? TAB_LABEL_ACTIVE : TAB_LABEL_INACTIVE, labelStyle]}
        >
          {label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
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

  // Indicador da aba ativa. Em `compact` a ativa é mais larga que as inativas,
  // então ele anima largura E posição — com slots iguais bastaria o translateX.
  const [barWidth, setBarWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const wide = tabLayoutFor(windowWidth) === "wide";
  const largura = wide
    ? evenTabWidth(barWidth, TABS.length, TAB_BAR_PADDING)
    : activeTabWidth(barWidth, TABS.length, TAB_BAR_PADDING);
  // Passo do indicador: em `wide` todas as abas medem `largura`; em `compact`
  // as anteriores à ativa são sempre inativas (o padrão de `tabOffset`).
  const passo = wide ? largura : undefined;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab),
  );
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const destinoX = tabOffset(activeIndex, TAB_BAR_PADDING, passo);
    const opcoes = { duration: Motion.duration.base, easing: Motion.easing.standard };
    indicatorX.value = reducedMotion ? destinoX : withTiming(destinoX, opcoes);
    indicatorW.value = reducedMotion ? largura : withTiming(largura, opcoes);
  }, [activeIndex, largura, passo, indicatorX, indicatorW, reducedMotion]);

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
            <Tab
              key={key}
              label={label}
              Icon={Icon}
              active={active}
              wide={wide}
              // Em `wide` as três dividem a barra por igual; em `compact` só a
              // ativa cresce e as outras ficam quadradas.
              width={wide || active ? largura : TAB_INACTIVE_WIDTH}
              onPress={() => onChangeTab(key)}
            />
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
