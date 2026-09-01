import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { DailySummary } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { MorphProgress, type MorphColor } from "./MorphProgress";

type Props = {
  summary: DailySummary | undefined;
  softMode?: boolean;
  /**
   * 0 = anéis (expandido), 1 = barras (colapsado). Omitir deixa o resumo
   * sempre expandido — é o caso das telas de histórico, onde ele não divide
   * espaço com uma lista rolável.
   */
  collapse?: SharedValue<number>;
};

/**
 * Geometria do resumo nos dois estados. Fica num objeto só porque a altura do
 * bloco é derivada daqui em três lugares (spacers, posição dos textos e a
 * altura que o morph reporta) — constantes soltas saíam de sintonia.
 */
export const SUMMARY = {
  kcal: {
    radius: 73,
    strokeExpanded: 14,
    strokeCollapsed: 10,
    /** Respiro acima da barra onde os números pousam no estado colapsado. */
    lead: 34,
    valueFont: 30,
    valueFontCollapsed: 17,
    subFont: 12,
    subFontCollapsed: 11,
    /** Centro vertical dos textos: expandido (dentro do anel) → colapsado. */
    valueY: [72, 15],
    subY: [96, 16],
    /** Folga entre o número e o "/ meta" quando ficam lado a lado. */
    gap: 6,
  },
  macro: {
    radius: 36,
    strokeExpanded: 8,
    strokeCollapsed: 6,
    lead: 24,
    valueFont: 18,
    valueFontCollapsed: 12,
    subFont: 12,
    subFontCollapsed: 11,
    valueY: [33, 10],
    subY: [50, 10],
    /** Folga entre o número e a meta quando ficam lado a lado. */
    gap: 3,
  },
  /** Espaço entre o bloco de calorias e a linha de macros. */
  groupGap: [24, 12],
} as const;

/**
 * Famílias por peso, espelhando os tokens do Tailwind. Precisam vir literais
 * porque os textos do morph são Animated.Text e não passam pelo NativeWind.
 */
const FONT = {
  display: "SpaceGrotesk_700Bold",
  body: "Inter_500Medium",
} as const;

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function fmtGrams(n: number): string {
  return `${Math.round(n)}g`;
}

/** Interpola entre dois valores. Espelha o `lerp` do worklet no lado JS. */
function lerp(a: number, b: number, t: number): number {
  "worklet";
  return a + (b - a) * t;
}

type MorphTextProps = {
  collapse: SharedValue<number>;
  /** Centro do texto: [expandido, colapsado]. */
  x: [number, number];
  y: [number, number];
  /** Corpo da fonte: [expandido, colapsado]. O encolhimento vira `scale`. */
  font: [number, number];
  /**
   * Família e cor vão por `style`, não por `className`: o NativeWind não
   * processa className em componentes do Reanimated — a prop é aceita e
   * ignorada em silêncio, e o texto sairia sem fonte nem cor.
   */
  fontFamily: string;
  color: string;
  onMeasure?: (w: number) => void;
  children: string;
};

/**
 * Texto que viaja entre duas posições durante o morph.
 *
 * O corpo da fonte fica fixo no valor expandido e o encolhimento é `scale`:
 * animar `fontSize` refaz o layout a cada frame, `scale` só compõe. Como o
 * transform da RN tem origem no centro da view, posicionar pelo centro faz a
 * escala e a translação concordarem sem ajuste.
 */
function MorphText({
  collapse,
  x,
  y,
  font,
  fontFamily,
  color,
  onMeasure,
  children,
}: MorphTextProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    onMeasure?.(width);
  }

  const boxStyle = useAnimatedStyle(() => {
    const t = collapse.value;
    return {
      transform: [
        { translateX: lerp(x[0], x[1], t) - size.w / 2 },
        { translateY: lerp(y[0], y[1], t) - size.h / 2 },
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lerp(1, font[1] / font[0], collapse.value) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={handleLayout}
      style={[{ position: "absolute", left: 0, top: 0 }, boxStyle]}
    >
      <Animated.Text
        style={[{ fontFamily, color, fontSize: font[0], fontVariant: ["tabular-nums"] }, textStyle]}
      >
        {children}
      </Animated.Text>
    </Animated.View>
  );
}

/** Spacer cuja altura acompanha o morph. */
function MorphSpacer({
  collapse,
  from,
  to,
}: {
  collapse: SharedValue<number>;
  from: number;
  to: number;
}) {
  const style = useAnimatedStyle(() => ({ height: lerp(from, to, collapse.value) }));
  return <Animated.View style={style} />;
}

function MacroMetric({
  value,
  max,
  color,
  label,
  collapse,
  width,
}: {
  value: number;
  max: number | null;
  color: MorphColor;
  label: string;
  collapse: SharedValue<number>;
  width: number;
}) {
  const m = SUMMARY.macro;
  const centro = width / 2;

  // Mesma medição do bloco de calorias: no colapsado o número e a meta ficam
  // lado a lado, então é preciso saber a largura de cada um já com a fonte
  // encolhida. A métrica escala junto com a fonte, daí a razão entre corpos.
  const [valueWidth, setValueWidth] = useState(0);
  const [subWidth, setSubWidth] = useState(0);
  const larguraValor = valueWidth * (m.valueFontCollapsed / m.valueFont);
  const larguraMeta = subWidth * (m.subFontCollapsed / m.subFont);

  // O par vira um bloco só, centrado na coluna — senão "166g/160g" nasceria
  // torto, com o número no meio e a meta transbordando pra direita.
  const larguraPar = larguraValor + m.gap + larguraMeta;
  const valorX = max ? centro - larguraPar / 2 + larguraValor / 2 : centro;
  const metaX = centro + larguraPar / 2 - larguraMeta / 2;

  return (
    <View style={{ width }}>
      <View>
        <MorphSpacer collapse={collapse} from={0} to={m.lead} />
        <MorphProgress
          value={value}
          max={max}
          color={color}
          collapse={collapse}
          width={width}
          radius={m.radius}
          strokeExpanded={m.strokeExpanded}
          strokeCollapsed={m.strokeCollapsed}
          accessibilityLabel={
            max ? `${fmtGrams(value)} de ${fmtGrams(max)} ${label}` : `${fmtGrams(value)} ${label}`
          }
        />
        <MorphText
          collapse={collapse}
          x={[centro, valorX]}
          y={[m.valueY[0], m.valueY[1]]}
          font={[m.valueFont, m.valueFontCollapsed]}
          onMeasure={setValueWidth}
          fontFamily={FONT.display}
          color={colors.neutral[900]}
        >
          {fmtGrams(value)}
        </MorphText>
        {/* No colapsado a meta encosta no número ("166g/160g") em vez de
            sumir: a barra sozinha mostra a proporção, mas não de quanto. */}
        {max ? (
          <MorphText
            collapse={collapse}
            x={[centro, metaX]}
            y={[m.subY[0], m.subY[1]]}
            font={[m.subFont, m.subFontCollapsed]}
            onMeasure={setSubWidth}
            fontFamily={FONT.body}
            color={colors.neutral[500]}
          >
            {`/${fmtGrams(max)}`}
          </MorphText>
        ) : null}
      </View>
      <Text
        className="mt-2 text-center font-sans-medium text-neutral-500 text-xs"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {label}
      </Text>
    </View>
  );
}

export function TodaySummaryHeader({ summary, softMode = false, collapse: collapseProp }: Props) {
  const fallbackCollapse = useSharedValue(0);
  const collapse = collapseProp ?? fallbackCollapse;
  // Loading state: rings em 0 + meta nula. Sem animação até dados chegarem.
  const kcal = summary?.kcal ?? 0;
  const protein = summary?.protein_g ?? 0;
  const carbs = summary?.carbs_g ?? 0;
  const fat = summary?.fat_g ?? 0;
  const goalKcal = summary?.goal_kcal ?? null;
  const goalProtein = summary?.goal_protein_g ?? null;
  const goalCarbs = summary?.goal_carbs_g ?? null;
  const goalFat = summary?.goal_fat_g ?? null;
  const mealsCount = summary?.meals_count ?? 0;

  // Largura do número no corpo expandido. Define onde ele e o "/ meta" pousam
  // lado a lado no colapsado — a métrica escala junto com a fonte, então basta
  // medir uma vez e aplicar a razão.
  const [valueWidth, setValueWidth] = useState(0);
  const [subWidth, setSubWidth] = useState(0);
  // A barra ocupa a largura toda do card, então a geometria depende dela. O
  // componente se mede sozinho para não obrigar cada chamador (Home e desktop,
  // com larguras diferentes) a calcular e repassar o mesmo número.
  const [width, setWidth] = useState(0);

  if (softMode) {
    return (
      <View className="items-center gap-2 px-6 pb-6 pt-4">
        <Text
          className="text-4xl font-display-bold text-neutral-800"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {mealsCount}
        </Text>
        <Text className="font-sans text-neutral-500">
          {mealsCount === 1 ? "refeição registrada hoje" : "refeições registradas hoje"}
        </Text>
      </View>
    );
  }

  const k = SUMMARY.kcal;
  const larguraValor = valueWidth * (k.valueFontCollapsed / k.valueFont);
  const larguraMeta = subWidth * (k.subFontCollapsed / k.subFont);
  const gapMacro = 10;
  const larguraMacro = Math.max(0, (width - gapMacro * 2) / 3);

  // Antes da primeira medição a altura expandida já é reservada, para o card
  // não nascer achatado e crescer com um salto no frame seguinte.
  if (width === 0) {
    return (
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 2 * k.radius + k.strokeExpanded }}
      />
    );
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View>
        <MorphSpacer collapse={collapse} from={0} to={k.lead} />
        <MorphProgress
          value={kcal}
          max={goalKcal}
          color="calories"
          collapse={collapse}
          width={width}
          radius={k.radius}
          strokeExpanded={k.strokeExpanded}
          strokeCollapsed={k.strokeCollapsed}
          accessibilityLabel={
            goalKcal
              ? `${fmtInt(kcal)} de ${fmtInt(goalKcal)} calorias`
              : `${fmtInt(kcal)} calorias`
          }
        />
        <MorphText
          collapse={collapse}
          x={[width / 2, larguraValor / 2]}
          y={[k.valueY[0], k.valueY[1]]}
          font={[k.valueFont, k.valueFontCollapsed]}
          onMeasure={setValueWidth}
          fontFamily={FONT.display}
          color={colors.neutral[900]}
        >
          {fmtInt(kcal)}
        </MorphText>
        <MorphText
          collapse={collapse}
          x={[width / 2, larguraValor + k.gap + larguraMeta / 2]}
          y={[k.subY[0], k.subY[1]]}
          font={[k.subFont, k.subFontCollapsed]}
          onMeasure={setSubWidth}
          fontFamily={FONT.body}
          color={colors.neutral[500]}
        >
          {goalKcal ? `/ ${fmtInt(goalKcal)} kcal` : "kcal"}
        </MorphText>
      </View>

      <MorphSpacer collapse={collapse} from={SUMMARY.groupGap[0]} to={SUMMARY.groupGap[1]} />

      <View className="flex-row" style={{ gap: gapMacro }}>
        <MacroMetric
          value={protein}
          max={goalProtein}
          color="protein"
          label="proteína"
          collapse={collapse}
          width={larguraMacro}
        />
        <MacroMetric
          value={carbs}
          max={goalCarbs}
          color="carbs"
          label="carboidrato"
          collapse={collapse}
          width={larguraMacro}
        />
        <MacroMetric
          value={fat}
          max={goalFat}
          color="fat"
          label="gordura"
          collapse={collapse}
          width={larguraMacro}
        />
      </View>
    </View>
  );
}
