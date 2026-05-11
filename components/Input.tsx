import React, { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  className?: string;
  containerClassName?: string;
}

// ─── Eye Icon (inline — sem dependência de biblioteca de ícone) ───────────────

function EyeIcon({ visible, color }: { visible: boolean; color: string }) {
  // SVG-like representation using View shapes — substituível por @expo/vector-icons
  return (
    <View className="w-5 h-5 items-center justify-center">
      <View
        className="w-5 h-3 rounded-full border-2"
        style={{ borderColor: color }}
      />
      {!visible && (
        <View
          className="absolute w-6 h-[1.5px] rotate-45"
          style={{ backgroundColor: color }}
        />
      )}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Input({
  label,
  error,
  leadingIcon,
  secureTextEntry = false,
  className = "",
  containerClassName = "",
  ...rest
}: InputProps) {
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
      {/* Label */}
      {label && (
        <Text className="text-sm font-sans-medium text-neutral-700 mb-1.5">
          {label}
        </Text>
      )}

      {/* Input container */}
      <View
        className={`flex-row items-center h-[52px] px-4 rounded-xl bg-white ${borderStyle}`}
      >
        {/* Leading icon */}
        {leadingIcon && (
          <View className="mr-3">
            {leadingIcon}
          </View>
        )}

        {/* Text input */}
        <TextInput
          className={`flex-1 text-base font-sans text-neutral-800 ${className}`}
          placeholderTextColor="#94A3B8"
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {/* Password visibility toggle */}
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsPasswordVisible((v) => !v)}
            className="ml-2 p-1"
            hitSlop={8}
          >
            <EyeIcon
              visible={isPasswordVisible}
              color={isFocused ? "#2DD4BF" : "#94A3B8"}
            />
          </Pressable>
        )}
      </View>

      {/* Error message */}
      {error && (
        <Text className="mt-1.5 text-xs font-sans-medium text-danger-500">
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Usage Examples ───────────────────────────────────────────────────────────
/*
import { Input } from "@/components/Input";
import { Ionicons } from "@expo/vector-icons";

// Email input
<Input
  label="Email Address"
  placeholder="Enter your email address..."
  keyboardType="email-address"
  autoCapitalize="none"
  value={email}
  onChangeText={setEmail}
  leadingIcon={<Ionicons name="mail-outline" size={20} color="#94A3B8" />}
  error={errors.email}
/>

// Password input (with toggle)
<Input
  label="Password"
  placeholder="••••••••••••••••"
  secureTextEntry
  value={password}
  onChangeText={setPassword}
  leadingIcon={<Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />}
  error={errors.password}
/>

// Confirm password
<Input
  label="Confirm Password"
  placeholder="••••••••••••••••"
  secureTextEntry
  value={confirmPassword}
  onChangeText={setConfirmPassword}
  leadingIcon={<Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />}
/>
*/
