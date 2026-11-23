import { useEffect, useState } from "react";
import { Image, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import {
  ENQUADRAMENTO_PADRAO,
  ZOOM_MAXIMO,
  type Enquadramento,
  type Tamanho,
} from "@/lib/media/crop";

/**
 * Editor de enquadramento: a foto preenche um quadro fixo e a pessoa arrasta e
 * aproxima dentro dele, como no story do Instagram.
 *
 * O quadro é a proporção final — o que se vê aqui é exatamente o que sai. Não
 * há borda, letterbox nem "caber inteira": a foto sempre cobre, e o que passa
 * do quadro é o que está sendo cortado.
 *
 * O componente não decide nada sobre a foto; devolve o enquadramento
 * normalizado e quem chama resolve se aquilo vira recorte gravado (ao publicar)
 * ou só ajuste de exibição (no card compartilhável). Ver `lib/media/crop.ts`.
 */
export function PhotoAdjuster({
  uri,
  aspect,
  value = ENQUADRAMENTO_PADRAO,
  onChange,
  radius = 0,
}: Props) {
  const [natural, setNatural] = useState<Tamanho | null>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    let ativo = true;
    Image.getSize(
      uri,
      (width, height) => ativo && setNatural({ width, height }),
      // Sem as medidas não dá para enquadrar nada; o chamador mostra a foto
      // parada e o editor simplesmente não aparece.
      () => ativo && setNatural(null),
    );
    return () => {
      ativo = false;
    };
  }, [uri]);

  const onLayout = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const escala = useSharedValue(value.scale);
  const dx = useSharedValue(value.dx);
  const dy = useSharedValue(value.dy);
  const escalaInicial = useSharedValue(value.scale);
  const dxInicial = useSharedValue(value.dx);
  const dyInicial = useSharedValue(value.dy);

  // Espelha mudanças vindas de fora (reset, troca de foto) nos shared values.
  useEffect(() => {
    escala.value = value.scale;
    dx.value = value.dx;
    dy.value = value.dy;
  }, [value.scale, value.dx, value.dy, escala, dx, dy]);

  const alturaQuadro = largura / aspect;
  const pronto = Boolean(natural) && largura > 0;
  const fotoW = natural?.width ?? 1;
  const fotoH = natural?.height ?? 1;

  // A mesma conta de `lib/media/crop.ts`, escrita aqui dentro porque worklet
  // não chama função importada. Se uma das duas mudar, a outra tem que mudar
  // junto — os testes de `crop.ts` fixam o comportamento esperado.
  const estiloFoto = useAnimatedStyle(() => {
    const base = Math.max(largura / fotoW, alturaQuadro / fotoH);
    const s = base * escala.value;
    const folgaX = Math.max(0, (fotoW * s - largura) / 2);
    const folgaY = Math.max(0, (fotoH * s - alturaQuadro) / 2);
    return {
      transform: [
        { translateX: dx.value * folgaX },
        { translateY: dy.value * folgaY },
        { scale: s },
      ],
    };
  }, [largura, alturaQuadro, fotoW, fotoH]);

  function comitar() {
    onChange({ scale: escala.value, dx: dx.value, dy: dy.value });
  }

  const arrastar = Gesture.Pan()
    .onBegin(() => {
      dxInicial.value = dx.value;
      dyInicial.value = dy.value;
    })
    .onUpdate((e) => {
      const base = Math.max(largura / fotoW, alturaQuadro / fotoH);
      const s = base * escala.value;
      const folgaX = Math.max(0, (fotoW * s - largura) / 2);
      const folgaY = Math.max(0, (fotoH * s - alturaQuadro) / 2);
      // Sem folga no eixo, o arrasto ali não move nada — e não divide por zero.
      dx.value =
        folgaX > 0 ? Math.min(1, Math.max(-1, dxInicial.value + e.translationX / folgaX)) : 0;
      dy.value =
        folgaY > 0 ? Math.min(1, Math.max(-1, dyInicial.value + e.translationY / folgaY)) : 0;
    })
    .onEnd(() => runOnJS(comitar)());

  const aproximar = Gesture.Pinch()
    .onBegin(() => {
      escalaInicial.value = escala.value;
    })
    .onUpdate((e) => {
      escala.value = Math.min(ZOOM_MAXIMO, Math.max(1, escalaInicial.value * e.scale));
    })
    .onEnd(() => {
      // Ao fechar o zoom, a folga encolhe e o arrasto guardado pode ter ficado
      // fora do novo limite — prender aqui evita a foto "saltar" no próximo
      // toque, que é quando o limite seria aplicado.
      dx.value = Math.min(1, Math.max(-1, dx.value));
      dy.value = Math.min(1, Math.max(-1, dy.value));
      runOnJS(comitar)();
    });

  // Simultâneo: no pinch os dois dedos também produzem um pan, e tratar um de
  // cada vez faria a foto escorregar enquanto aproxima.
  const gesto = Gesture.Simultaneous(arrastar, aproximar);

  return (
    <View
      onLayout={onLayout}
      style={{ width: "100%", aspectRatio: aspect, borderRadius: radius }}
      className="overflow-hidden bg-neutral-200"
    >
      {pronto ? (
        // `touchAction="none"`: aqui o arrasto em QUALQUER direção é do editor,
        // então o navegador não pode tratar o vertical como rolagem da página.
        <GestureDetector gesture={gesto} touchAction="none">
          {/* Sem className no Animated.View: o NativeWind não processa a prop
              em componentes do Reanimated e o estilo cairia fora. */}
          <Animated.View style={{ width: "100%", height: "100%" }}>
            <Animated.Image
              source={{ uri }}
              accessibilityIgnoresInvertColors
              accessibilityLabel="Foto da refeição. Arraste para mover, use dois dedos para aproximar."
              resizeMode="cover"
              style={[
                {
                  position: "absolute",
                  left: (largura - fotoW) / 2,
                  top: (alturaQuadro - fotoH) / 2,
                  width: fotoW,
                  height: fotoH,
                },
                estiloFoto,
              ]}
            />
          </Animated.View>
        </GestureDetector>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-sm text-neutral-500">Carregando foto…</Text>
        </View>
      )}
    </View>
  );
}

type Props = {
  uri: string;
  /** Proporção do quadro: largura ÷ altura. 4:5 = 0.8. */
  aspect: number;
  value?: Enquadramento;
  onChange: (e: Enquadramento) => void;
  radius?: number;
};
