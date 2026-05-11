import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "dark" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

// ─── Style Maps ───────────────────────────────────────────────────────────────

const containerStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-400 border-transparent",
  dark: "bg-neutral-900 border-transparent",
  outline: "bg-transparent border border-neutral-200",
  ghost: "bg-transparent border-transparent",
};

const containerPressedStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-500",
  dark: "bg-neutral-700",
  outline: "bg-neutral-100",
  ghost: "bg-neutral-100",
};

const containerDisabledStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-200 border-transparent",
  dark: "bg-neutral-400 border-transparent",
  outline: "bg-transparent border border-neutral-200 opacity-50",
  ghost: "bg-transparent border-transparent opacity-50",
};

const labelStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  dark: "text-white",
  outline: "text-neutral-800",
  ghost: "text-primary-400",
};

const sizeContainerStyles: Record<ButtonSize, string> = {
  sm: "h-[40px] px-4",
  md: "h-[52px] px-6",
  lg: "h-[60px] px-8",
};

const sizeLabelStyles: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = "",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      className={({ pressed }) => {
        const base = "rounded-full flex-row items-center justify-center";
        const variantStyle = isDisabled
          ? containerDisabledStyles[variant]
          : pressed
            ? containerPressedStyles[variant]
            : containerStyles[variant];

        return `${base} ${sizeContainerStyles[size]} ${variantStyle} ${className}`;
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? "#2DD4BF" : "#ffffff"}
        />
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text
            className={`font-sans-semibold ${sizeLabelStyles[size]} ${labelStyles[variant]}`}
          >
            {label}
          </Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}

/*
─── Usage Examples ─────────────────────────────────────────────────────────────

import { Button } from "@/components/Button";
import { ArrowRight } from "lucide-react-native";

// Primary CTA (Get Started →)
<Button
  label="Get Started"
  variant="primary"
  rightIcon={<ArrowRight size={18} color="#fff" />}
  onPress={() => router.push("/onboarding")}
/>

// Dark (Sign In With Google)
<Button label="Sign In With Google" variant="dark" onPress={handleGoogleSignIn} />

// Outline (Skipped)
<Button label="Skipped" variant="outline" size="sm" onPress={handleSkip} />

// Ghost / Link (Sign Up)
<Button label="Sign Up" variant="ghost" onPress={() => router.push("/signup")} />

// Loading state
<Button label="Sign In" variant="primary" loading={isSubmitting} onPress={handleSubmit} />

// Disabled state
<Button label="Sign Up" variant="primary" disabled={!isFormValid} onPress={handleSubmit} />
*/
