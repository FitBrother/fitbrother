import { useState } from "react";
import { View } from "react-native";
import type { BillingInterval } from "@fitbrother/shared";
import { Button } from "@/components/Button";

interface PlanChoiceProps {
  pending: boolean;
  onSubscribe: (interval: BillingInterval) => void;
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
}

export function PlanChoice({
  pending,
  onSubscribe,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
}: PlanChoiceProps) {
  const [selected, setSelected] = useState<BillingInterval | null>(null);

  function subscribe(interval: BillingInterval) {
    setSelected(interval);
    onSubscribe(interval);
  }

  return (
    <View className="gap-3">
      <Button
        label="Assinar mensal"
        size="lg"
        loading={pending && selected === "month"}
        disabled={pending}
        onPress={() => subscribe("month")}
        accessibilityRole="button"
        accessibilityLabel="Assinar plano mensal"
      />
      <Button
        label="Assinar anual"
        size="lg"
        loading={pending && selected === "year"}
        disabled={pending}
        onPress={() => subscribe("year")}
        accessibilityRole="button"
        accessibilityLabel="Assinar plano anual"
      />
      <Button
        label={secondaryLabel}
        variant="outline"
        size="md"
        disabled={secondaryDisabled}
        onPress={onSecondary}
        accessibilityRole="button"
      />
    </View>
  );
}
