import { useState } from "react";
import { Text, View } from "react-native";
import MaskInput, { Masks } from "react-native-mask-input";
import { colors } from "@/lib/colors";

interface DateInputProps {
  label?: string;
  /** Masked value, e.g. "22/05/2002". Empty string when unset. */
  value: string;
  onChangeText: (masked: string) => void;
  /** External error string. Wins over internal validation messages. */
  error?: string;
  placeholder?: string;
}

export function DateInput({
  label,
  value,
  onChangeText,
  error,
  placeholder = "DD/MM/AAAA",
}: DateInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const borderStyle = error
    ? "border-[1.5px] border-danger-500"
    : isFocused
      ? "border-[1.5px] border-primary-400"
      : "border border-neutral-200";

  return (
    <View className="w-full">
      {label && <Text className="mb-1.5 text-sm font-sans-medium text-neutral-700">{label}</Text>}

      <View className={`h-[52px] flex-row items-center rounded-xl bg-white px-4 ${borderStyle}`}>
        <MaskInput
          className="flex-1 text-base font-sans text-neutral-800"
          style={{ fontVariant: ["tabular-nums"] }}
          value={value}
          onChangeText={(masked) => onChangeText(masked)}
          mask={Masks.DATE_DDMMYYYY}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral[400]}
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          textContentType="none"
          maxLength={10}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {error && <Text className="mt-1.5 text-xs font-sans-medium text-danger-500">{error}</Text>}
    </View>
  );
}
