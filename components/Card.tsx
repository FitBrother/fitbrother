import React from "react";
import { Platform, Pressable, type PressableProps, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardVariant = "elevated" | "outlined" | "flat";

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: PressableProps["onPress"];
  className?: string;
}

// ─── Shadow Styles (plataforma-específico para Android + iOS) ─────────────────

const shadowStyleElevated = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
  default: {},
});

const shadowStyleElevatedPressed = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
  },
  android: {
    elevation: 5,
  },
  default: {},
});

// ─── Style Maps ───────────────────────────────────────────────────────────────

const variantContainerClass: Record<CardVariant, string> = {
  elevated: "bg-white rounded-2xl p-4",
  outlined: "bg-white rounded-2xl p-4 border border-neutral-200",
  flat: "bg-neutral-50 rounded-2xl p-4",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Card({
  children,
  variant = "elevated",
  onPress,
  className = "",
}: CardProps) {
  const baseClass = `${variantContainerClass[variant]} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) =>
          variant === "elevated"
            ? pressed
              ? shadowStyleElevatedPressed
              : shadowStyleElevated
            : undefined
        }
        className={({ pressed }) =>
          `${baseClass} ${pressed && variant !== "elevated" ? "opacity-80" : ""}`
        }
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      className={baseClass}
      style={variant === "elevated" ? shadowStyleElevated : undefined}
    >
      {children}
    </View>
  );
}

// ─── Usage Examples ───────────────────────────────────────────────────────────
/*
import { Card } from "@/components/Card";

// Health metric card (onboarding)
<Card variant="elevated">
  <View className="flex-row items-center justify-between mb-2">
    <View className="flex-row items-center gap-2">
      <Ionicons name="heart" size={18} color="#EF4444" />
      <Text className="text-base font-semibold text-neutral-800">Heart Rate</Text>
    </View>
    <Text className="text-sm text-neutral-400">Today</Text>
  </View>
  <Text className="text-2xl font-bold text-neutral-900">72 bpm</Text>
  <Text className="text-sm text-neutral-500">Resting Rate</Text>
</Card>

// Pharmacy card (outlined)
<Card variant="outlined">
  <Text className="text-base font-bold text-neutral-800">Safeway</Text>
  <Text className="text-sm text-neutral-500">19.2 miles</Text>
</Card>

// Tappable card (navigates to details)
<Card variant="elevated" onPress={() => router.push("/medication/123")}>
  <Text className="text-base font-semibold text-neutral-800">Acetaminophen 500mg</Text>
</Card>

// Flat card (list items, Forgot Password options)
<Card variant="flat">
  <View className="flex-row items-center gap-3">
    <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center">
      <Ionicons name="mail-outline" size={20} color="#2DD4BF" />
    </View>
    <Text className="text-base font-medium text-neutral-800">Send via Email</Text>
  </View>
</Card>
*/
