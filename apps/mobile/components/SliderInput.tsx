import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors } from "@/lib/colors";

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  // Posição opcional de um traço fino na track — usado pra marcar o valor
  // recomendado (ex. proteína calculada) enquanto o usuário ajusta.
  markerValue?: number;
  onChange: (value: number) => void;
}

function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  return Math.min(2, String(step).split(".")[1]?.length ?? 0);
}

// Só dígitos, vírgula e ponto — barra letras/símbolos antes mesmo de entrar no campo.
function sanitizeNumericText(raw: string): string {
  return raw.replace(/[^0-9.,]/g, "");
}

export function SliderInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  markerValue,
  onChange,
}: SliderInputProps) {
  const decimals = decimalsFor(step);
  const [text, setText] = useState(value.toFixed(decimals));
  const [focused, setFocused] = useState(false);
  const [clampMessage, setClampMessage] = useState<string | null>(null);

  // Sincroniza o texto quando o valor muda por fora (slider, ou outro
  // campo reagindo) — mas não enquanto o usuário está digitando.
  useEffect(() => {
    if (!focused) setText(value.toFixed(decimals));
  }, [value, decimals, focused]);

  function handleChangeText(raw: string) {
    setClampMessage(null);
    setText(sanitizeNumericText(raw));
  }

  function commit(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    const next = Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed));
    setClampMessage(
      !Number.isNaN(parsed) && parsed !== next
        ? next === min
          ? `Ajustado para o mínimo (${min}${unit ?? ""}).`
          : `Ajustado para o máximo (${max}${unit ?? ""}).`
        : null,
    );
    onChange(Number(next.toFixed(decimals)));
    setText(next.toFixed(decimals));
  }

  const markerPct =
    markerValue !== undefined ? ((markerValue - min) / (max - min)) * 100 : undefined;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sans-medium text-neutral-700">{label}</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={text}
            onChangeText={handleChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(text);
            }}
            onSubmitEditing={() => commit(text)}
            keyboardType="decimal-pad"
            className="min-w-[52px] rounded-lg border border-neutral-200 bg-white px-2 py-1 text-right text-sm font-sans-semibold text-neutral-800"
            style={{ fontVariant: ["tabular-nums"] }}
            accessibilityLabel={`${label} — valor exato`}
          />
          {unit && <Text className="text-sm font-sans text-neutral-500">{unit}</Text>}
        </View>
      </View>
      <View className="justify-center">
        {markerPct !== undefined && (
          <View
            pointerEvents="none"
            className="absolute top-[13px] h-3.5 w-[2px] bg-neutral-400"
            style={{ left: `${markerPct}%` }}
          />
        )}
        <Slider
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={(v) => {
            setClampMessage(null);
            onChange(Number(v.toFixed(decimals)));
          }}
          minimumTrackTintColor={colors.primary[400]}
          maximumTrackTintColor={colors.neutral[200]}
          thumbTintColor={colors.primary[500]}
        />
      </View>
      {clampMessage && (
        <Text className="text-xs font-sans-medium text-warning-500">{clampMessage}</Text>
      )}
    </View>
  );
}
