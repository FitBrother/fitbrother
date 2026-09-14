import { Heart } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { useToggleLike } from "@/lib/hooks/useToggleLike";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/**
 * Mola da volta do coração ao tamanho normal, depois do pico.
 *
 * Razão de amortecimento ~0,69 (`damping / 2√(stiffness·mass)`): sobra um
 * repique de uns 2%, o suficiente para o retorno ter vida, e assenta na
 * primeira oscilação.
 *
 * `damping: 12` foi a primeira tentativa e dava razão 0,38 — medido no
 * navegador, o coração afundava até 0,90 depois do pico, um segundo repique
 * bem visível. É pior que a default do Reanimated (0,5), que o `Motion.spring`
 * de lib/motion.ts já tinha rejeitado por soar errado no SwipeableTabs.
 */
const POP_SPRING = { mass: 0.6, damping: 22, stiffness: 420 };

export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string;
  liked: boolean;
  count: number;
}) {
  const toggle = useToggleLike();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  function onPress() {
    const proximo = !liked;
    toggle.mutate({ postId, liked: proximo });

    // A animação dispara no TOQUE, não num efeito observando `liked`. A prop
    // também muda quando o Realtime traz a curtida de outra pessoa, e a tela
    // do usuário pipocaria sozinha por ação alheia.
    if (!proximo || reducedMotion) {
      // Descurtir encolhe e volta, sem anel: tirar a curtida não é conquista
      // nenhuma, e comemorar isso soaria errado.
      scale.value = withTiming(1, { duration: Motion.duration.fast });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, POP_SPRING));
    ringScale.value = 0;
    ringOpacity.value = 0.3;
    ringScale.value = withTiming(2.2, {
      duration: Motion.duration.base,
      easing: Motion.easing.decelerate,
    });
    ringOpacity.value = withTiming(0, { duration: Motion.duration.base });
  }

  // Estilo inline, não className: o NativeWind não processa className em
  // componentes do Reanimated.
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Descurtir post" : "Curtir post"}
      className="min-h-[44px] min-w-[44px] flex-row items-center gap-1.5 px-2"
    >
      <View className="h-5 w-5 items-center justify-center">
        {/* Anel atrás do coração, com `position: absolute` para não empurrar o
            layout ao crescer — um irmão no fluxo faria a contagem ao lado
            pular a cada curtida.
            `danger-500` com opacidade baixa, e não um `danger-200`: o mirror JS
            em lib/colors.ts só espelha 50/500/600 da escala, e inventar um tom
            aqui sairia do token. */}
        <Animated.View
          style={[
            ringStyle,
            {
              position: "absolute",
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.danger[500],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View style={heartStyle}>
          <Heart
            size={20}
            color={liked ? colors.danger[500] : colors.neutral[500]}
            fill={liked ? colors.danger[500] : "transparent"}
          />
        </Animated.View>
      </View>
      <Text style={NUM} className="font-sans-medium text-neutral-600">
        {count}
      </Text>
    </Pressable>
  );
}
