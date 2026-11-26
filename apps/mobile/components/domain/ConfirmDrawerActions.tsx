import { Pressable, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function ConfirmButton({
  sending,
  disabled,
  onPress,
  className = "",
}: {
  sending: boolean;
  disabled: boolean;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Button
      label="Confirmar"
      accessibilityLabel="Confirmar"
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || sending, busy: sending }}
      onPress={onPress}
      loading={sending}
      disabled={disabled}
      className={className}
    />
  );
}

export function DiscardLink({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Descartar refeição"
      accessibilityState={{ disabled }}
      className={`min-h-[44px] items-center justify-center ${disabled ? "opacity-50" : ""}`}
    >
      <Text className="font-sans-semibold text-sm text-neutral-500">Descartar</Text>
    </Pressable>
  );
}

export function DrawerBackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="-ml-2 min-h-[44px] min-w-[44px] items-center justify-center"
    >
      <ChevronLeft size={24} color={colors.neutral[800]} />
    </Pressable>
  );
}

export function KcalTotal({ kcal, size }: { kcal: number; size: "lg" | "sm" }) {
  const large = size === "lg";
  return (
    <View className="items-end">
      <Text
        style={NUM}
        className={`font-display-bold text-neutral-900 ${
          large ? "text-[40px] leading-[44px]" : "text-[22px] leading-7"
        }`}
      >
        {String(Math.round(kcal))}
      </Text>
      <Text className="font-sans-medium text-xs text-neutral-500">kcal</Text>
    </View>
  );
}
