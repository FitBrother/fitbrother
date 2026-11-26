import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { History } from "lucide-react-native";
import type { FoodSuggestion } from "@fitbrother/shared";
import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import { UNIT_LABEL } from "@/lib/unit-labels";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { FoodSuggestionsSkeleton } from "./FoodSuggestionsSkeleton";
import {
  NoResultPanel,
  SearchErrorPanel,
  SearchHint,
  SectionTitle,
  ShortQueryPanel,
} from "./FoodSearchPanels";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };
const BLUR_CLOSE_MS = 150;

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSelect: (s: FoodSuggestion) => void;
  autoFocus?: boolean;
};

// Portion and kcal always on the same basis: last use for recents, serving (or 100 g) for catalog.
function rowMeta(s: FoodSuggestion): { portion: string | null; kcal: number | null } {
  if (s.kind === "recent") {
    const portion =
      s.quantity !== null && s.unit !== null ? `${s.quantity} ${UNIT_LABEL[s.unit]}` : null;
    return { portion, kcal: s.kcal === null ? null : Math.round(s.kcal) };
  }
  if (s.kcal_per_100g === null) return { portion: null, kcal: null };
  if (s.serving_grams !== null && s.serving_grams > 0) {
    return {
      portion: s.serving_label ?? `${s.serving_grams} g`,
      kcal: Math.round((s.kcal_per_100g * s.serving_grams) / 100),
    };
  }
  return { portion: "100 g", kcal: Math.round(s.kcal_per_100g) };
}

function metaText(portion: string | null, kcal: number | null): string | null {
  const kcalText = kcal === null ? null : `${kcal} kcal`;
  if (portion && kcalText) return `${portion} · ${kcalText}`;
  return portion ?? kcalText;
}

function rowA11yLabel(s: FoodSuggestion, portion: string | null, kcal: number | null): string {
  return [
    s.name,
    s.kind === "recent" ? "recente" : null,
    portion,
    kcal === null ? null : `${kcal} kcal`,
  ]
    .filter((p): p is string => p !== null)
    .join(", ");
}

export function FoodAutocomplete({ value, onChangeText, onSelect, autoFocus = false }: Props) {
  const [focused, setFocused] = useState(autoFocus);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data, isLoading, isError, isFetching, isPlaceholderData, isSettled, refetch } =
    useFoodSuggestions(value, focused);
  const suggestions = data ?? [];
  const term = value.trim();
  const isEmpty = term.length === 0;
  const isShort = term.length === 1;
  const canSearch = term.length >= 2;
  const failed = canSearch && isError && suggestions.length === 0;
  const noResult =
    canSearch &&
    !isError &&
    !isLoading &&
    !isFetching &&
    !isPlaceholderData &&
    isSettled &&
    suggestions.length === 0;

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

  const closePanel = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocused(false);
  };

  const showList =
    focused && (isEmpty || isShort || isLoading || failed || noResult || suggestions.length > 0);

  const renderRow = (s: FoodSuggestion, i: number) => {
    const { portion, kcal } = rowMeta(s);
    const meta = metaText(portion, kcal);
    const firstOfKind = i === 0 || suggestions[i - 1]?.kind !== s.kind;
    const title = !canSearch
      ? i === 0
        ? "Usados recentemente"
        : null
      : firstOfKind
        ? s.kind === "recent"
          ? "Recentes"
          : "Catálogo"
        : null;
    return (
      <View key={`${s.food_id ?? s.name}-${i}`}>
        {title ? <SectionTitle>{title}</SectionTitle> : null}
        <Pressable
          onPress={() => handleSelect(s)}
          accessibilityRole="button"
          accessibilityLabel={rowA11yLabel(s, portion, kcal)}
          className="min-h-[44px] min-w-[44px] justify-center px-3 py-2 active:bg-neutral-50"
        >
          <Text numberOfLines={1} className="text-sm font-sans-medium text-neutral-800">
            {s.name}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            {s.kind === "recent" ? (
              <>
                <History size={12} color={colors.neutral[500]} />
                <Text className="text-xs font-sans-medium text-neutral-500">Recente</Text>
                {meta ? <Text className="text-xs font-sans text-neutral-400">·</Text> : null}
              </>
            ) : null}
            {meta ? (
              <Text style={NUM} className="text-xs font-sans text-neutral-500">
                {meta}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };

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
        autoFocus={autoFocus}
        placeholder="Buscar alimento"
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
          {isEmpty ? <SearchHint /> : null}
          {isShort ? <ShortQueryPanel onPickExample={onChangeText} /> : null}
          {isLoading ? <FoodSuggestionsSkeleton /> : null}
          {failed ? (
            <SearchErrorPanel term={term} onRetry={() => void refetch()} onUseTyped={closePanel} />
          ) : null}
          {noResult ? <NoResultPanel term={term} onUseTyped={closePanel} /> : null}
          {!isLoading && !isShort ? suggestions.map(renderRow) : null}
        </View>
      ) : null}
    </View>
  );
}
