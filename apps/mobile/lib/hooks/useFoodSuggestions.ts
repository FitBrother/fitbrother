import { useQuery } from "@tanstack/react-query";
import type { FoodSuggestion } from "@fitbrother/shared";
import { searchFoods } from "@/lib/api/foods";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export function useFoodSuggestions(q: string, enabled: boolean) {
  const typed = q.trim();
  const trimmed = useDebouncedValue(typed, 250);
  const active = enabled && (trimmed === "" || trimmed.length >= 2);
  const query = useQuery({
    queryKey: ["food-suggestions", trimmed],
    queryFn: () => searchFoods(trimmed),
    enabled: active,
    staleTime: 30_000,
    retry: 1,
    // Keep the previous list while the next term loads, but never for a disabled (1-char) term.
    placeholderData: (prev: FoodSuggestion[] | undefined) => (active ? prev : undefined),
  });
  return { ...query, isSettled: trimmed === typed };
}
