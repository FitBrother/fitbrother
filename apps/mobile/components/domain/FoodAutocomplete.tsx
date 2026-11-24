import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { History } from "lucide-react-native";
import type { FoodSuggestion } from "@fitbrother/shared";
import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import { UNIT_LABEL } from "@/lib/unit-labels";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { FoodSuggestionsSkeleton } from "./FoodSuggestionsSkeleton";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };
const BLUR_CLOSE_MS = 150;

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSelect: (s: FoodSuggestion) => void;
};

function portionLabel(s: FoodSuggestion): string {
  if (s.serving_label) return s.serving_label;
  if (s.kind === "recent" && s.quantity !== null && s.unit !== null) {
    return `${s.quantity} ${UNIT_LABEL[s.unit]}`;
  }
  return "100 g";
}

function kcalLabel(s: FoodSuggestion): string | null {
  if (s.kcal !== null) return `${Math.round(s.kcal)} kcal`;
  if (s.kcal_per_100g !== null) return `${Math.round(s.kcal_per_100g)} kcal`;
  return null;
}

export function FoodAutocomplete({ value, onChangeText, onSelect }: Props) {
  const [focused, setFocused] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data, isLoading } = useFoodSuggestions(value, focused);
  const suggestions = data ?? [];

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocused(true);
  };

  // Delay so a tap on a row lands before the list unmounts (web blurs on press-down).
  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setFocused(false), BLUR_CLOSE_MS);
  };

  const handleSelect = (s: FoodSuggestion) => {
    onSelect(s);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocused(false);
  };

  const showList = focused && (isLoading || suggestions.length > 0);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(t) => {
          setFocused(true);
          onChangeText(t);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Descrição"
        accessibilityLabel="Descrição do item"
        maxLength={60}
        className="text-base font-sans-medium text-neutral-800"
      />
      {showList ? (
        <View
          testID="food-suggestions"
          style={shadows.card}
          className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1"
        >
          {isLoading ? (
            <FoodSuggestionsSkeleton />
          ) : (
            suggestions.map((s, i) => {
              const kcal = kcalLabel(s);
              return (
                <Pressable
                  key={`${s.food_id ?? s.name}-${i}`}
                  onPress={() => handleSelect(s)}
                  accessibilityRole="button"
                  accessibilityLabel={s.name}
                  className="min-h-[44px] min-w-[44px] flex-row items-center justify-between gap-3 px-3 py-2 active:bg-neutral-50"
                >
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-sm font-sans-medium text-neutral-800">
                      {s.name}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-1">
                      {s.kind === "recent" ? (
                        <>
                          <History size={12} color={colors.neutral[500]} />
                          <Text className="text-xs font-sans-medium text-neutral-500">Recente</Text>
                          <Text className="text-xs font-sans text-neutral-400">·</Text>
                        </>
                      ) : null}
                      <Text style={NUM} className="text-xs font-sans text-neutral-500">
                        {portionLabel(s)}
                      </Text>
                    </View>
                  </View>
                  {kcal ? (
                    <Text style={NUM} className="text-xs font-sans-medium text-neutral-600">
                      {kcal}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}
