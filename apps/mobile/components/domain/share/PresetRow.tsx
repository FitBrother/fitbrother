import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Flame, Minus, Tag, Type } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";

import type { SharedValue } from "react-native-reanimated";
import type { StoryPresetId } from "@/lib/share/story";
import type { StoryPreset } from "@/lib/share/story-presets";

/** Distância entre duas bolinhas. */
export const PASSO_PRESET = 72;

const BOLINHA = 56;
const ANEL = 76;

const ICONES: Record<StoryPresetId, typeof Flame> = {
  completo: Flame,
  etiqueta: Tag,
  discreto: Minus,
  poster: Type,
};

/** Para onde a fila vai ao soltar o arrasto. */
export function proximoIndice(index: number, arrasto: number, total: number): number {
  if (Math.abs(arrasto) <= PASSO_PRESET / 3) return index;
  const alvo = index + (arrasto < 0 ? 1 : -1);
  return Math.min(Math.max(alvo, 0), total - 1);
}

function Bolinha({
  preset,
  indice,
  posicao,
  arrasto,
  onPress,
}: {
  preset: StoryPreset;
  indice: number;
  posicao: SharedValue<number>;
  arrasto: SharedValue<number>;
  onPress: () => void;
}) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: (indice - posicao.value) * PASSO_PRESET + arrasto.value }],
  }));
  const Icone = ICONES[preset.id];

  return (
    // Cada bolinha anda sozinha dentro de um contêiner da largura toda, em vez
    // de uma fila inteira deslizando: no Android, toque fora dos limites do pai
    // não chega ao filho, e uma fila de largura fixa perderia as laterais.
    <Animated.View
      style={[
        {
          position: "absolute",
          left: "50%",
          top: (ANEL - BOLINHA) / 2,
          marginLeft: -BOLINHA / 2,
        },
        estilo,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Preset ${preset.label}`}
        style={{ width: BOLINHA, height: BOLINHA }}
        className="items-center justify-center rounded-full border border-white/40 bg-ink/50"
      >
        <Icone size={22} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * A fila de presets ao redor do disparo, como a de filtros do Instagram.
 *
 * O anel fica parado no centro e as bolinhas passam por trás dele. A bolinha do
 * preset em cena é a que está debaixo do anel, então o toque nela é o toque no
 * anel: na câmera tira a foto, no editor refaz o arranjo.
 */
export function PresetRow({
  presets,
  index,
  onSelecionar,
  onCentro,
  centroDesabilitado = false,
  rotuloCentro,
  ocupado = false,
}: {
  presets: readonly StoryPreset[];
  index: number;
  onSelecionar: (i: number) => void;
  onCentro: () => void;
  centroDesabilitado?: boolean;
  /** O que o anel faz aqui: "Tirar foto" na câmera, "Refazer" no editor. */
  rotuloCentro: string;
  ocupado?: boolean;
}) {
  const posicao = useSharedValue(index);
  const arrasto = useSharedValue(0);
  const total = presets.length;

  useEffect(() => {
    posicao.value = withTiming(index, {
      duration: Motion.duration.base,
      easing: Motion.easing.standard,
    });
  }, [index, posicao]);

  function soltar(distancia: number) {
    const proximo = proximoIndice(index, distancia, total);
    if (proximo !== index) onSelecionar(proximo);
  }

  const deslizar = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      arrasto.value = e.translationX;
    })
    .onEnd((e) => {
      runOnJS(soltar)(e.translationX);
    })
    .onFinalize(() => {
      arrasto.value = withTiming(0, {
        duration: Motion.duration.fast,
        easing: Motion.easing.standard,
      });
    });

  return (
    <View className="items-center">
      <Text className="mb-2 font-sans-semibold text-sm text-white">
        {presets[index]?.label ?? ""}
      </Text>
      <GestureDetector gesture={deslizar} touchAction="pan-y">
        <View collapsable={false} style={{ height: ANEL, width: "100%" }}>
          {total > 1
            ? presets.map((p, i) => (
                <Bolinha
                  key={p.id}
                  preset={p}
                  indice={i}
                  posicao={posicao}
                  arrasto={arrasto}
                  onPress={() => onSelecionar(i)}
                />
              ))
            : null}
          <View
            style={{ position: "absolute", left: "50%", top: 0, marginLeft: -ANEL / 2 }}
            className="rounded-full"
          >
            <Pressable
              onPress={onCentro}
              disabled={centroDesabilitado}
              accessibilityRole="button"
              accessibilityLabel={rotuloCentro}
              accessibilityState={{ disabled: centroDesabilitado, busy: ocupado }}
              style={{ width: ANEL, height: ANEL, borderWidth: 4 }}
              className="items-center justify-center rounded-full border-primary-400 bg-white/20 active:bg-white/40 disabled:opacity-50"
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
