import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface OnboardingNavButtonsProps {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  backDisabled?: boolean;
}

export function OnboardingNavButtons({
  onBack,
  onNext,
  nextDisabled = false,
  backDisabled = false,
}: OnboardingNavButtonsProps) {
  return (
    <View className="flex-row items-center justify-between">
      <NavButton direction="back" onPress={onBack} disabled={backDisabled || !onBack} />
      <NavButton direction="next" onPress={onNext} disabled={nextDisabled || !onNext} />
    </View>
  );
}

function NavButton({
  direction,
  onPress,
  disabled,
}: {
  direction: "back" | "next";
  onPress?: () => void;
  disabled: boolean;
}) {
  const Icon = direction === "back" ? ChevronLeft : ChevronRight;
  const label = direction === "back" ? "Voltar" : "Avançar";
  const bg = disabled ? "bg-neutral-300" : "bg-neutral-900";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className={`h-12 w-12 items-center justify-center rounded-full active:bg-neutral-700 ${bg}`}
    >
      <Icon size={20} color="#ffffff" />
    </Pressable>
  );
}
