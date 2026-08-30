import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { usePathname } from "expo-router";
import { Motion } from "@/lib/motion";

/**
 * Decide se a transição de tela deve rodar.
 *
 * Só no web: em iOS/Android o `animation` do Stack (react-native-screens) já
 * anima nativamente, e sobrepor um fade em JS deixaria as duas animações
 * competindo. No web aquele `animation` é ignorado — medido: navegar entre
 * telas não produzia nenhum frame de fade nem de transform.
 */
export function shouldFadeScreens(platform: string, reducedMotion: boolean): boolean {
  return platform === "web" && !reducedMotion;
}

/**
 * Faz o conteúdo da rota atual aparecer com fade a cada navegação.
 *
 * Fica no layout, não em cada tela: as 21 telas de `(app)` passam por aqui, e
 * animar num ponto só evita repetir o wrapper (e esquecer dele em telas novas).
 * A opacidade é reiniciada por mudança de pathname, sem remontar o Stack —
 * remontá-lo perderia o estado de navegação.
 */
export function ScreenFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const ativo = shouldFadeScreens(Platform.OS, reducedMotion);

  // useLayoutEffect (não useEffect) para zerar a opacidade antes da pintura —
  // com useEffect a tela nova aparece opaca por um frame antes do fade, o que
  // lê como piscada.
  useLayoutEffect(() => {
    if (!ativo) return;
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: Motion.duration.base,
      easing: Motion.easing.decelerate,
    });
  }, [pathname, ativo, opacity]);

  // Estilo inline: o NativeWind não processa className em componentes do
  // Reanimated.
  const style = useAnimatedStyle(() => ({ flex: 1, opacity: opacity.value }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
