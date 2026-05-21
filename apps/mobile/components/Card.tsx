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

// ─── Style Maps ───────────────────────────────────────────────────────────────

const variantContainerClass: Record<CardVariant, string> = {
  elevated: "bg-white rounded-2xl p-4",
  outlined: "bg-white rounded-2xl p-4 border border-neutral-200",
  flat: "bg-neutral-50 rounded-2xl p-4",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Card({ children, variant = "elevated", onPress, className = "" }: CardProps) {
  const baseClass = `${variantContainerClass[variant]} ${className}`;

  if (onPress) {
    // NativeWind v4 (SDK 54) doesn't accept callback className — use the
    // `active:` modifier and a plain style for the pressed shadow.
    return (
      <Pressable
        onPress={onPress}
        style={variant === "elevated" ? shadowStyleElevated : undefined}
        className={`${baseClass} ${variant !== "elevated" ? "active:opacity-80" : ""}`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={baseClass} style={variant === "elevated" ? shadowStyleElevated : undefined}>
      {children}
    </View>
  );
}

// ─── Usage Examples ───────────────────────────────────────────────────────────
/*
import { Card } from "@/components/Card";
import { Heart, Mail } from "lucide-react-native";

// Health metric card
<Card variant="elevated">
  <View className="flex-row items-center justify-between mb-2">
    <View className="flex-row items-center gap-2">
      <Heart size={18} color="#EF4444" />
      <Text className="text-base font-sans-semibold text-neutral-800">Heart Rate</Text>
    </View>
    <Text className="text-sm font-sans text-neutral-400">Today</Text>
  </View>
  <Text
    className="text-2xl font-sans-bold text-neutral-900"
    style={{ fontVariant: ["tabular-nums"] }}
  >
    72 bpm
  </Text>
</Card>

// Tappable card (navigates to details)
<Card variant="elevated" onPress={() => router.push("/meal/123")}>
  <Text className="text-base font-sans-semibold text-neutral-800">Café da manhã</Text>
</Card>

// Flat card (list items)
<Card variant="flat">
  <View className="flex-row items-center gap-3">
    <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center">
      <Mail size={20} color="#2DD4BF" />
    </View>
    <Text className="text-base font-sans-medium text-neutral-800">Send via Email</Text>
  </View>
</Card>
*/
