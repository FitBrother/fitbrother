import { Eye, EyeOff } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, type TextInputProps, View } from "react-native";

import { colors } from "@/lib/colors";

/** Cheap-but-decent password strength heuristic. Avoids zxcvbn (~400KB)
 *  in favor of a quick 0-4 score based on length + character diversity.
 *  Mirrors the rule of thumb used by Stripe / Linear sign-up. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABEL = ["Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"] as const;
const STRENGTH_COLOR = [
  colors.danger[500],
  colors.danger[500],
  colors.warning[500],
  colors.success[500],
  colors.success[500],
] as const;

interface PasswordInputProps extends Omit<
  TextInputProps,
  "style" | "secureTextEntry" | "value" | "onChangeText"
> {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  /** Show the strength meter under the field. Use on sign-up, not sign-in. */
  showStrength?: boolean;
}

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(
  { label, value, onChangeText, error, showStrength = false, ...rest },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const borderStyle = error
    ? "border-[1.5px] border-danger-500"
    : isFocused
      ? "border-[1.5px] border-primary-400"
      : "border border-neutral-200";

  const strength = passwordStrength(value);
  const showMeter = showStrength && value.length > 0;

  return (
    <View className="w-full">
      {label && <Text className="mb-1.5 text-sm font-sans-medium text-neutral-700">{label}</Text>}

      <View className={`h-[52px] flex-row items-center rounded-xl bg-white px-4 ${borderStyle}`}>
        <TextInput
          ref={ref}
          className="flex-1 text-base font-sans text-neutral-800"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={colors.neutral[400]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        <Pressable
          onPress={() => setVisible((v) => !v)}
          className="ml-2 p-1"
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Esconder senha" : "Mostrar senha"}
        >
          {visible ? (
            <EyeOff size={20} color={isFocused ? colors.primary[400] : colors.neutral[400]} />
          ) : (
            <Eye size={20} color={isFocused ? colors.primary[400] : colors.neutral[400]} />
          )}
        </Pressable>
      </View>

      {showMeter && (
        <View className="mt-2">
          <View className="flex-row gap-1">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{
                  backgroundColor: i < strength ? STRENGTH_COLOR[strength] : colors.neutral[200],
                }}
              />
            ))}
          </View>
          <Text
            className="mt-1.5 text-xs font-sans-medium"
            style={{ color: strength === 0 ? colors.neutral[400] : STRENGTH_COLOR[strength] }}
          >
            {STRENGTH_LABEL[strength]}
          </Text>
        </View>
      )}

      {error && <Text className="mt-1.5 text-xs font-sans-medium text-danger-500">{error}</Text>}
    </View>
  );
});
