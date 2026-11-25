import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { Macros } from "@fitbrother/shared";
import type { ItemDraft } from "@/lib/meal-item-draft";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function parseNumber(text: string): number {
  return text === "" ? 0 : Number(text.replace(",", "."));
}

export function formatNumber(n: number): string {
  return String(n).replace(".", ",");
}

export function NumberField({
  label,
  accessibilityLabel,
  value,
  onChange,
  className,
}: {
  label?: string;
  accessibilityLabel: string;
  value: number;
  onChange: (n: number) => void;
  className: string;
}) {
  const [text, setText] = useState(formatNumber(value));

  useEffect(() => {
    setText((prev) => (parseNumber(prev) === value ? prev : formatNumber(value)));
  }, [value]);

  const input = (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const parsed = parseNumber(t);
        if (!Number.isNaN(parsed)) onChange(Math.max(0, parsed));
      }}
      keyboardType="decimal-pad"
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      style={NUM}
      className={className}
    />
  );
  if (!label) return input;
  return (
    <View className="flex-1">
      <Text className="font-sans-medium text-xs text-neutral-500">{label}</Text>
      {input}
    </View>
  );
}

export function MacroEditFields({
  item,
  onChangeMacro,
}: {
  item: ItemDraft;
  onChangeMacro: (patch: Partial<Macros>) => void;
}) {
  const fieldClass =
    "mt-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 font-sans-medium text-base text-neutral-800";
  const fields: { label: string; a11y: string; value: number; key: keyof Macros }[] = [
    { label: "kcal", a11y: "kcal", value: item.kcal, key: "kcal" },
    { label: "P (g)", a11y: "Proteína (g)", value: item.protein_g, key: "protein_g" },
    { label: "C (g)", a11y: "Carboidrato (g)", value: item.carbs_g, key: "carbs_g" },
    { label: "G (g)", a11y: "Gordura (g)", value: item.fat_g, key: "fat_g" },
  ];
  return (
    <View className="mt-3 flex-row gap-2">
      {fields.map((f) => (
        <NumberField
          key={f.key}
          label={f.label}
          accessibilityLabel={`${f.a11y}, valor numérico`}
          value={f.value}
          onChange={(n) => onChangeMacro({ [f.key]: n })}
          className={fieldClass}
        />
      ))}
    </View>
  );
}
