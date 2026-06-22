import React, { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { colors } from "@/lib/colors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  className?: string;
  containerClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    leadingIcon,
    secureTextEntry = false,
    className = "",
    containerClassName = "",
    ...rest
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecure = secureTextEntry && !isPasswordVisible;

  const borderStyle = error
    ? "border-[1.5px] border-danger-500"
    : isFocused
      ? "border-[1.5px] border-primary-400"
      : "border border-neutral-200";

  return (
    <View className={`w-full ${containerClassName}`}>
      {label && <Text className="text-sm font-sans-medium text-neutral-700 mb-1.5">{label}</Text>}

      <View className={`flex-row items-center h-[52px] px-4 rounded-xl bg-white ${borderStyle}`}>
        {leadingIcon && <View className="mr-3">{leadingIcon}</View>}

        <TextInput
          ref={ref}
          className={`flex-1 text-base font-sans text-neutral-800 ${className}`}
          placeholderTextColor="#94A3B8"
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {secureTextEntry && (
          <Pressable
            onPress={() => setIsPasswordVisible((v) => !v)}
            className="ml-2 p-1"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Esconder senha" : "Mostrar senha"}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={isFocused ? colors.primary[400] : colors.neutral[400]} />
            ) : (
              <Eye size={20} color={isFocused ? colors.primary[400] : colors.neutral[400]} />
            )}
          </Pressable>
        )}
      </View>

      {error && <Text className="mt-1.5 text-xs font-sans-medium text-danger-500">{error}</Text>}
    </View>
  );
});

// ─── Usage Examples ───────────────────────────────────────────────────────────
/*
import { Input } from "@/components/Input";
import { Mail, Lock } from "lucide-react-native";

// Email input
<Input
  label="Email Address"
  placeholder="Enter your email address..."
  keyboardType="email-address"
  autoCapitalize="none"
  value={email}
  onChangeText={setEmail}
  leadingIcon={<Mail size={20} color="#94A3B8" />}
  error={errors.email}
/>

// Password input (with toggle)
<Input
  label="Password"
  placeholder="••••••••••••••••"
  secureTextEntry
  value={password}
  onChangeText={setPassword}
  leadingIcon={<Lock size={20} color="#94A3B8" />}
  error={errors.password}
/>
*/
